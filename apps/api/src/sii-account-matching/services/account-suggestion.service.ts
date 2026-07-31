import { createHash } from "node:crypto";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { Brackets, DataSource, In, IsNull } from "typeorm";
import {
  CompanyAccountSuggestionEntity,
  CompanyAccountSuggestionStatus,
} from "../../accounting/entities/company-account-suggestion.entity";
import { TaxPeriodCompanyAccountEntity } from "../../accounting/entities/tax-period-company-account.entity";
import { CompanyAccountEntity } from "../../company-account-plan/entities/company-account.entity";
import { CompanyAccountMappingStatus } from "../../company-account-plan/enums/company-account-plan.enums";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import {
  SiiAccountTermEntity,
  type SiiAccountTermType,
} from "../entities/sii-account-term.entity";
import {
  normalizeAccountTerm,
  relevantWords,
  weightedTokenSimilarity,
} from "../normalization/account-term-normalizer";
import { ACCOUNT_SUGGESTION_CONFIG } from "../account-suggestion.config";
import { AccountCandidateGeneratorService } from "./account-candidate-generator.service";
import { AccountSuggestionRankingService } from "./account-suggestion-ranking.service";
import { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import { resolveCatalogExpenseKnowledge } from "../data/catalog-expense-knowledge";
import { SiiAccountKnowledgeEntity } from "../entities/sii-account-knowledge.entity";
import { AccountMatchingRuleEntity } from "../entities/account-matching-rule.entity";
import { AccountMatchingLearningEntity } from "../entities/account-matching-learning.entity";
import { AccountMatchingLearningIndustryEntity } from "../entities/account-matching-learning-industry.entity";
import { AccountMatchingDiagnosticEntity } from "../entities/account-matching-diagnostic.entity";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { TaxPeriodEntity } from "../../accounting/entities/tax-period.entity";
import type { AccountLearningEvidence } from "../account-matching.types";
export { ACCOUNT_SUGGESTION_CONFIG } from "../account-suggestion.config";

const POSITIVE_TERM_TYPES = new Set<SiiAccountTermType>([
  "official_name",
  "alias",
  "abbreviation",
  "manual_term",
  "erp_term",
  "industry_term",
]);

type Candidate = {
  account: SiiAccountEntity;
  score: number;
  confidence: number;
  exact: boolean;
  reasons: Array<{ signal: string; description: string; points: number }>;
};

type BalanceContext = {
  assetAmount: string;
  liabilityAmount: string;
  lossAmount: string;
  gainAmount: string;
  debitBalance: string;
  creditBalance: string;
};

type AccountWithContext = CompanyAccountEntity & {
  matchingContext?: BalanceContext;
};

type TermIndexes = {
  positiveTermsByNormalizedTerm: Map<string, SiiAccountTermEntity[]>;
  negativeTermsByNormalizedTerm: Map<string, SiiAccountTermEntity[]>;
};

type DiscardReason =
  | "below_minimum_score"
  | "ambiguous_candidates"
  | "no_positive_terms"
  | "all_candidates_penalized"
  | "confirmed_mapping"
  | "unsupported_term_type";

@Injectable()
export class AccountSuggestionService {
  private readonly logger = new Logger(AccountSuggestionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly candidateGenerator: AccountCandidateGeneratorService = new AccountCandidateGeneratorService(),
    private readonly ranking: AccountSuggestionRankingService = new AccountSuggestionRankingService(),
  ) {}

  async generateForPeriod(companyId: string, taxPeriodId: string) {
    const company = await this.loadCompanyContext(companyId, taxPeriodId);
    const accounts = await this.loadCompanyAccounts(companyId, taxPeriodId);
    const loadedTerms = await this.loadTerms(companyId);
    const loadedConcepts = await this.loadConcepts();
    const loadedKnowledge = await this.loadKnowledge();
    const loadedRules = await this.loadRules();
    const loadedLearning = await this.loadLearning(
      accounts,
      company.industryId,
    );
    const siiAccountIds = Array.from(
      new Set([
        ...loadedTerms.map((term) => term.siiAccountId),
        ...loadedKnowledge.map((item) => item.siiAccountId),
        ...loadedLearning.map((item) => item.siiAccountId),
      ]),
    );
    // Terms are synchronized against the selected active SII version. Resolving
    // by those real account ids prevents mixing candidates from older versions.
    const siiAccounts = await this.loadSiiAccounts(siiAccountIds);
    const expenseKnowledge = resolveCatalogExpenseKnowledge(siiAccounts);
    const siiAccountsById = new Map(
      siiAccounts.map((account) => [account.id, account]),
    );
    const foundAccountIds = Array.from(siiAccountsById.keys());
    const missingAccountIds = siiAccountIds.filter(
      (id) => !siiAccountsById.has(id),
    );
    const accountResolution = {
      requestedAccountIds: siiAccountIds,
      foundAccountIds,
      missingAccountIds,
    };
    if (missingAccountIds.length) {
      this.logger.warn({
        message: "No se encontraron todas las cuentas SII referenciadas",
        ...accountResolution,
      });
    }

    const diagnostics = {
      accountsProcessed: accounts.length,
      mappingsReused: 0,
      termsLoaded: loadedTerms.length,
      globalTermsLoaded: loadedTerms.filter((term) => term.scope === "global")
        .length,
      companyTermsLoaded: loadedTerms.filter((term) => term.scope === "company")
        .length,
      siiAccountIdsRequested: siiAccountIds.length,
      siiAccountsFound: foundAccountIds.length,
      siiAccountIdsMissing: missingAccountIds.length,
      exactMatches: 0,
      aliasMatches: 0,
      lexicalMatches: 0,
      candidatesGenerated: 0,
      candidatesDiscardedByScore: 0,
      candidatesDiscardedByAmbiguity: 0,
      candidatesDiscardedByCompatibility: 0,
      suggestionsCreated: 0,
      withoutSuggestion: 0,
      withoutSuggestionReasons: {} as Record<DiscardReason, number>,
      algorithmVersion: ACCOUNT_SUGGESTION_CONFIG.algorithmVersion,
      averageConfidence: 0,
      catalogExpenseDestinations: expenseKnowledge.destinations.map(
        (destination) => {
          const account = siiAccounts.find(
            (candidate) => candidate.code === destination.code,
          );
          return {
            ...destination,
            classification: "expense" as const,
            concepts: loadedConcepts
              .filter((concept) => concept.siiAccountId === account?.id)
              .map((concept) => concept.concept),
          };
        },
      ),
    };

    await this.dataSource.transaction(async (manager) => {
      const suggestionRepository = manager.getRepository(
        CompanyAccountSuggestionEntity,
      );
      const diagnosticRepository = manager.getRepository(
        AccountMatchingDiagnosticEntity,
      );
      const diagnosticsEnabled =
        typeof diagnosticRepository.softDelete === "function";
      if (diagnosticsEnabled)
        await diagnosticRepository.softDelete({ companyId, taxPeriodId });
      for (const companyAccount of accounts) {
        if (
          companyAccount.mapping?.status ===
          CompanyAccountMappingStatus.CONFIRMED
        ) {
          this.discard(
            diagnostics.withoutSuggestionReasons,
            "confirmed_mapping",
          );
          diagnostics.mappingsReused++;
          continue;
        }

        // Retire the previous active generation inside the same transaction.
        // A failed transaction restores it, while a successful no-match cannot
        // leave a stale suggestion looking approvable.
        await suggestionRepository.update(
          {
            companyAccountId: companyAccount.id,
            status: CompanyAccountSuggestionStatus.ACTIVE,
          },
          { status: CompanyAccountSuggestionStatus.SUPERSEDED },
        );

        const generatedCandidates = this.candidateGenerator.generate(
          siiAccounts,
          loadedTerms,
          loadedConcepts,
          loadedKnowledge,
          loadedLearning,
        );
        const deterministic = this.ranking.rank(
          companyAccount.name,
          generatedCandidates,
          companyAccount.matchingContext,
          loadedRules,
        );
        const generatedAt = new Date();
        if (diagnosticsEnabled)
          await diagnosticRepository.save(
            diagnosticRepository.create({
              companyId,
              taxPeriodId,
              companyAccountId: companyAccount.id,
              accountName: companyAccount.name,
              normalizedName: normalizeAccountTerm(companyAccount.name),
              observedSection: deterministic.observedSection,
              decision: deterministic.decision,
              decisionReason: deterministic.reviewRequiredByRule
                ? "review_required_by_rule"
                : deterministic.decision === "review"
                  ? deterministic.candidates[0]?.metadata.statementSection ===
                    "unknown"
                    ? "unknown_candidate_classification"
                    : "below_minimum_score_or_confidence"
                  : deterministic.decision === "ambiguous"
                    ? "ambiguous_candidates"
                    : deterministic.decision === "no_candidate"
                      ? "no_candidate"
                      : "automatic",
              algorithmVersion: ACCOUNT_SUGGESTION_CONFIG.algorithmVersion,
              candidates: deterministic.allCandidates.map((candidate) => ({
                siiAccountId: candidate.account.id,
                code: candidate.account.code,
                name: candidate.account.name,
                metadata: candidate.metadata,
                score: candidate.score,
                confidence: candidate.confidence,
                signals: candidate.reasons,
              })),
              discardedCandidates: deterministic.discardedCandidates,
              rulesEvaluated: deterministic.evaluatedRules,
              generatedAt,
            }),
          );
        const ranked = {
          candidates: deterministic.candidates.map((candidate) => ({
            ...candidate,
            exact: candidate.reasons.some(
              (reason) => reason.signal === "exact_alias",
            ),
          })),
          exactMatches: deterministic.candidates.filter((candidate) =>
            candidate.reasons.some((reason) => reason.signal === "exact_alias"),
          ).length,
          discardedByScore:
            deterministic.decision === "review"
              ? deterministic.candidates.length
              : 0,
          discardReason:
            deterministic.decision === "ambiguous"
              ? ("ambiguous_candidates" as const)
              : undefined,
        };
        /* Retrieval, hard compatibility and scoring finish before persistence.
           Review-only candidates remain diagnostics, never active approvals. */
        if (deterministic.decision === "review") {
          this.discard(
            diagnostics.withoutSuggestionReasons,
            "below_minimum_score",
          );
          diagnostics.candidatesDiscardedByScore += ranked.candidates.length;
          diagnostics.candidatesDiscardedByCompatibility +=
            deterministic.discardedCandidates.length;
          diagnostics.withoutSuggestion++;
          continue;
        }
        diagnostics.exactMatches += ranked.exactMatches;
        diagnostics.aliasMatches += ranked.candidates.filter((candidate) =>
          candidate.reasons.some((reason) => reason.signal.includes("alias")),
        ).length;
        diagnostics.lexicalMatches += ranked.candidates.filter((candidate) =>
          candidate.reasons.some(
            (reason) => reason.signal === "token_similarity",
          ),
        ).length;
        diagnostics.candidatesGenerated += ranked.candidates.length;
        diagnostics.candidatesDiscardedByCompatibility +=
          deterministic.discardedCandidates.length;
        diagnostics.candidatesDiscardedByScore += ranked.discardedByScore;

        if (ranked.discardReason) {
          this.discard(
            diagnostics.withoutSuggestionReasons,
            ranked.discardReason,
          );
          if (ranked.discardReason === "ambiguous_candidates")
            diagnostics.candidatesDiscardedByAmbiguity +=
              ranked.candidates.length;
          diagnostics.withoutSuggestion++;
          continue;
        }

        const suggestions = ranked.candidates
          .slice(0, ACCOUNT_SUGGESTION_CONFIG.topCandidates)
          .map((candidate, index) =>
            suggestionRepository.create({
              companyAccountId: companyAccount.id,
              siiAccountId: candidate.account.id,
              suggestionRank: index + 1,
              score: candidate.score.toFixed(2),
              confidence: candidate.confidence.toFixed(4),
              algorithmVersion: ACCOUNT_SUGGESTION_CONFIG.algorithmVersion,
              reasons: candidate.reasons,
              status: CompanyAccountSuggestionStatus.ACTIVE,
              generatedAt,
              reviewedByUserId: null,
              reviewedAt: null,
            }),
          );
        await suggestionRepository.save(suggestions);
        diagnostics.suggestionsCreated += suggestions.length;
        diagnostics.averageConfidence += suggestions.reduce(
          (sum, suggestion) => sum + Number(suggestion.confidence),
          0,
        );
      }
    });

    return {
      ...diagnostics,
      averageConfidence: diagnostics.suggestionsCreated
        ? diagnostics.averageConfidence / diagnostics.suggestionsCreated
        : 0,
      suggested: diagnostics.suggestionsCreated,
    };
  }

  private loadCompanyAccounts(
    companyId: string,
    taxPeriodId: string,
  ): Promise<AccountWithContext[]> {
    return this.dataSource
      .getRepository(CompanyAccountEntity)
      .createQueryBuilder("account")
      .innerJoinAndMapOne(
        "account.matchingContext",
        TaxPeriodCompanyAccountEntity,
        "periodAccount",
        "periodAccount.companyAccountId = account.id AND periodAccount.companyId = :companyId AND periodAccount.taxPeriodId = :taxPeriodId",
        { companyId, taxPeriodId },
      )
      .leftJoinAndSelect("account.mapping", "mapping")
      .where("account.companyId = :companyId", { companyId })
      .andWhere("account.deletedAt IS NULL")
      .andWhere("periodAccount.discardedAt IS NULL")
      .distinct(true)
      .getMany() as Promise<AccountWithContext[]>;
  }

  private loadSiiAccounts(ids?: string[]) {
    return this.dataSource.getRepository(SiiAccountEntity).find({
      where: {
        ...(ids ? { id: In(ids) } : {}),
        deletedAt: IsNull(),
      },
    });
  }

  private loadTerms(companyId: string) {
    return this.dataSource
      .getRepository(SiiAccountTermEntity)
      .createQueryBuilder("term")
      .where("term.active = :active", { active: true })
      .andWhere("term.deletedAt IS NULL")
      .andWhere(
        new Brackets((query) => {
          query
            .where("term.scope = :globalScope AND term.companyId IS NULL", {
              globalScope: "global",
            })
            .orWhere(
              "term.scope = :companyScope AND term.companyId = :companyId",
              { companyScope: "company", companyId },
            );
        }),
      )
      .getMany();
  }

  private loadConcepts() {
    return this.dataSource.getRepository(SiiAccountConceptEntity).find({
      where: { active: true, deletedAt: IsNull() },
    });
  }

  private loadKnowledge() {
    if (typeof this.dataSource.getRepository !== "function") return [];
    return this.dataSource
      .getRepository(SiiAccountKnowledgeEntity)
      .find({ where: { active: true, deletedAt: IsNull() } });
  }

  private loadRules() {
    if (typeof this.dataSource.getRepository !== "function") return [];
    return this.dataSource.getRepository(AccountMatchingRuleEntity).find({
      where: { active: true, deletedAt: IsNull() },
      order: { priority: "DESC" },
    });
  }

  private async loadCompanyContext(companyId: string, taxPeriodId: string) {
    const company = await this.dataSource
      .getRepository(CompanyEntity)
      .findOne({ where: { id: companyId, deletedAt: IsNull() } });
    if (!company) throw new NotFoundException("Empresa no encontrada.");
    const period = await this.dataSource
      .getRepository(TaxPeriodEntity)
      .findOne({
        where: { id: taxPeriodId, companyId, deletedAt: IsNull() },
      });
    if (!period)
      throw new NotFoundException("Período tributario no encontrado.");
    return company;
  }

  private async loadLearning(
    accounts: AccountWithContext[],
    industryId: string | null,
  ): Promise<AccountLearningEvidence[]> {
    if (typeof this.dataSource.getRepository !== "function") return [];
    const hashes = Array.from(
      new Set(
        accounts.map((account) =>
          createHash("sha256")
            .update(normalizeAccountTerm(account.name), "utf8")
            .digest("hex"),
        ),
      ),
    );
    if (!hashes.length) return [];
    // Exact normalized-name hashes use the global unique index and keep the
    // read bounded. Lexical similarity from terms remains an independent source.
    const global = await this.dataSource
      .getRepository(AccountMatchingLearningEntity)
      .find({
        where: { normalizedNameHash: In(hashes), deletedAt: IsNull() },
      });
    if (!industryId || !global.length) return global;
    const industries = await this.dataSource
      .getRepository(AccountMatchingLearningIndustryEntity)
      .find({
        where: {
          learningId: In(global.map((item) => item.id)),
          industryId,
          deletedAt: IsNull(),
        },
      });
    const byLearningId = new Map(
      industries.map((item) => [item.learningId, item]),
    );
    return global.map((item) =>
      Object.assign(item, { industryEvidence: byLearningId.get(item.id) }),
    );
  }

  private rank(
    siiAccountsById: Map<string, SiiAccountEntity>,
    positiveTerms: SiiAccountTermEntity[],
    negativeTerms: SiiAccountTermEntity[],
    normalizedName?: string,
    context?: BalanceContext,
  ) {
    let exactMatches = 0;
    let discardedByScore = 0;
    let positiveTermsSeen = 0;
    let penalizedCandidates = 0;
    const debugTerms: Array<{ type: string; weight: number; term: string }> =
      [];
    const candidates: Candidate[] = [];

    const matchedTermsByAccount = new Map<string, SiiAccountTermEntity[]>();
    for (const term of [...positiveTerms, ...negativeTerms]) {
      const accountTerms = matchedTermsByAccount.get(term.siiAccountId) ?? [];
      accountTerms.push(term);
      matchedTermsByAccount.set(term.siiAccountId, accountTerms);
    }

    for (const [siiAccountId, matchedTerms] of matchedTermsByAccount) {
      const account = siiAccountsById.get(siiAccountId);
      if (!account) continue;
      const reasons: Candidate["reasons"] = [];
      let exact = false;
      const exactByText = new Map<string, SiiAccountTermEntity>();
      let bestToken: { term: SiiAccountTermEntity; similarity: number } | null =
        null;
      let bestLexical: {
        term: SiiAccountTermEntity;
        similarity: number;
      } | null = null;
      for (const term of matchedTerms) {
        const weight = Number(term.weight);
        debugTerms.push({ type: term.type, weight, term: term.term });
        if (term.type === "negative_term") {
          reasons.push({
            signal: "negative_term",
            description: `Penalización por término negativo: ${term.term}`,
            points: -Math.abs(weight),
          });
        } else if (POSITIVE_TERM_TYPES.has(term.type)) {
          const similarity = normalizedName
            ? this.tokenSimilarity(normalizedName, term.normalizedTerm)
            : 1;
          positiveTermsSeen++;
          const isExact =
            !normalizedName || normalizedName === term.normalizedTerm;
          if (isExact) {
            const prior = exactByText.get(term.normalizedTerm);
            if (!prior || this.exactWeight(term) > this.exactWeight(prior))
              exactByText.set(term.normalizedTerm, term);
          } else {
            if (!bestToken || similarity > bestToken.similarity)
              bestToken = { term, similarity };
            const lexical = this.lexicalSimilarity(
              normalizedName ?? "",
              term.normalizedTerm,
            );
            if (!bestLexical || lexical > bestLexical.similarity)
              bestLexical = { term, similarity: lexical };
          }
        }
      }
      for (const term of exactByText.values()) {
        exactMatches++;
        exact = true;
        reasons.push({
          signal:
            term.scope === "company"
              ? "exact_company_alias"
              : `exact_${term.type}`,
          description: `Coincidencia exacta con ${term.type}: ${term.term}`,
          points: this.exactWeight(term),
        });
      }
      if (
        bestToken &&
        bestToken.similarity >=
          ACCOUNT_SUGGESTION_CONFIG.lexicalCandidateThreshold
      )
        reasons.push({
          signal: "token_similarity",
          description: `Similitud ponderada de tokens (${Math.round(bestToken.similarity * 100)}%) con: ${bestToken.term.term}`,
          points: Math.round(
            ACCOUNT_SUGGESTION_CONFIG.weights.tokenSimilarityMaximum *
              bestToken.similarity,
          ),
        });
      if (
        bestLexical &&
        bestLexical.similarity >=
          ACCOUNT_SUGGESTION_CONFIG.lexicalCandidateThreshold
      )
        reasons.push({
          signal: "lexical_similarity",
          description: `Similitud léxica (${Math.round(bestLexical.similarity * 100)}%) con: ${bestLexical.term.term}`,
          points: Math.round(
            ACCOUNT_SUGGESTION_CONFIG.weights.lexicalSimilarityMaximum *
              bestLexical.similarity,
          ),
        });
      reasons.push(...this.contextReasons(account, context));
      const score = reasons.reduce((sum, reason) => sum + reason.points, 0);
      if (reasons.some((reason) => reason.points < 0) && score <= 0)
        penalizedCandidates++;
      if (score < ACCOUNT_SUGGESTION_CONFIG.minimumSuggestionScore) {
        if (reasons.some((reason) => reason.points > 0)) discardedByScore++;
        continue;
      }
      candidates.push({
        account,
        score,
        exact,
        confidence: Math.min(
          1,
          score / ACCOUNT_SUGGESTION_CONFIG.scoreForFullConfidence,
        ),
        reasons,
      });
    }
    candidates.sort(
      (left, right) =>
        right.score - left.score ||
        left.account.code.localeCompare(right.account.code),
    );
    const difference = candidates[0]
      ? candidates[0].score - (candidates[1]?.score ?? 0)
      : 0;
    const relativeDifference = candidates[0]?.score
      ? difference / candidates[0].score
      : 0;
    const discardReason: DiscardReason | undefined = !candidates.length
      ? positiveTermsSeen === 0
        ? penalizedCandidates > 0
          ? "all_candidates_penalized"
          : "no_positive_terms"
        : "below_minimum_score"
      : candidates.length > 1 &&
          (difference < ACCOUNT_SUGGESTION_CONFIG.minimumAbsoluteDifference ||
            relativeDifference <
              ACCOUNT_SUGGESTION_CONFIG.minimumRelativeDifference)
        ? "ambiguous_candidates"
        : undefined;
    if (discardReason === "ambiguous_candidates") {
      for (const candidate of candidates)
        candidate.reasons.push({
          signal: "ambiguous_candidates",
          description:
            "Los dos primeros candidatos tienen puntajes demasiado próximos",
          points: 0,
        });
    }
    return {
      candidates,
      exactMatches,
      discardedByScore,
      debugTerms,
      discardReason,
    };
  }

  private tokenSimilarity(left: string, right: string): number {
    return weightedTokenSimilarity(left, right);
  }

  private exactWeight(term: SiiAccountTermEntity): number {
    const weights = ACCOUNT_SUGGESTION_CONFIG.weights;
    if (term.scope === "company") return weights.exactCompanyAlias;
    return (
      (
        {
          official_name: weights.exactOfficialName,
          alias: weights.exactAlias,
          erp_term: weights.exactErpTerm,
          abbreviation: weights.exactAbbreviation,
          manual_term: weights.exactManualTerm,
          industry_term: weights.exactIndustryTerm,
        } as Partial<Record<SiiAccountTermType, number>>
      )[term.type] ?? Number(term.weight)
    );
  }

  private lexicalSimilarity(left: string, right: string): number {
    if (!left || !right) return 0;
    const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
    for (let column = 1; column <= right.length; column++) {
      let previous = rows[0];
      rows[0] = column;
      for (let row = 1; row <= left.length; row++) {
        const saved = rows[row];
        rows[row] = Math.min(
          rows[row] + 1,
          rows[row - 1] + 1,
          previous + (left[row - 1] === right[column - 1] ? 0 : 1),
        );
        previous = saved;
      }
    }
    return 1 - rows[left.length] / Math.max(left.length, right.length);
  }

  private contextReasons(
    account: SiiAccountEntity,
    context?: BalanceContext,
  ): Candidate["reasons"] {
    if (!context) return [];
    const name = normalizeAccountTerm(account.name);
    const isComplementary =
      name.includes("depreciacion acumulada") ||
      name.includes("depreciacion menos");
    const family = /ingreso|venta|ganancia/.test(name)
      ? "income"
      : /gasto|costo|perdida/.test(name)
        ? "expense"
        : /proveedor|pagar|pasivo|obligacion|deuda|retencion/.test(name)
          ? "liability"
          : "asset";
    const amounts = {
      asset: Number(context.assetAmount),
      liability: Number(context.liabilityAmount),
      loss: Number(context.lossAmount),
      gain: Number(context.gainAmount),
      debit: Number(context.debitBalance),
      credit: Number(context.creditBalance),
    };
    const observed = amounts.liability
      ? "liability"
      : amounts.asset
        ? "asset"
        : amounts.loss
          ? "expense"
          : amounts.gain
            ? "income"
            : null;
    const reasons: Candidate["reasons"] = [];
    if (observed)
      reasons.push({
        signal:
          observed === family || (isComplementary && observed === "asset")
            ? "compatible_classification"
            : "incompatible_classification",
        description: `${observed === family || (isComplementary && observed === "asset") ? "Clasificación contable compatible" : "Clasificación contable incompatible"} con ${account.name}`,
        points:
          observed === family || (isComplementary && observed === "asset")
            ? ACCOUNT_SUGGESTION_CONFIG.weights.compatibleClassification
            : ACCOUNT_SUGGESTION_CONFIG.weights.incompatibleClassification,
      });
    const expectedDebit =
      (family === "asset" && !isComplementary) || family === "expense";
    if (amounts.debit || amounts.credit) {
      const compatible = expectedDebit ? amounts.debit > 0 : amounts.credit > 0;
      reasons.push({
        signal: compatible
          ? "compatible_balance_nature"
          : "incompatible_balance_nature",
        description: compatible
          ? "Naturaleza del saldo compatible"
          : "Naturaleza del saldo incompatible",
        points: compatible
          ? ACCOUNT_SUGGESTION_CONFIG.weights.compatibleBalanceNature
          : ACCOUNT_SUGGESTION_CONFIG.weights.incompatibleBalanceNature,
      });
    }
    return reasons;
  }

  private termOccurs(name: string, term: string): boolean {
    if (!term) return false;
    const nameWords = relevantWords(name);
    const termWords = relevantWords(term);
    return (
      termWords.size > 0 && [...termWords].every((word) => nameWords.has(word))
    );
  }

  private buildTermIndexes(terms: SiiAccountTermEntity[]): TermIndexes {
    const positiveTermsByNormalizedTerm = new Map<
      string,
      SiiAccountTermEntity[]
    >();
    const negativeTermsByNormalizedTerm = new Map<
      string,
      SiiAccountTermEntity[]
    >();

    for (const term of terms) {
      const key = term.normalizedTerm;
      if (!key) continue;

      const targetMap =
        term.type === "negative_term"
          ? negativeTermsByNormalizedTerm
          : positiveTermsByNormalizedTerm;
      const existingTerms = targetMap.get(key) ?? [];
      existingTerms.push(term);
      targetMap.set(key, existingTerms);
    }

    return { positiveTermsByNormalizedTerm, negativeTermsByNormalizedTerm };
  }

  private discard(
    counts: Record<DiscardReason, number>,
    reason: DiscardReason,
  ) {
    counts[reason] = (counts[reason] ?? 0) + 1;
  }
}

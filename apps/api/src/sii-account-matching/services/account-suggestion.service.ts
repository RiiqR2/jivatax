import { createHash } from "node:crypto";
import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from "@nestjs/common";
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
import { CurrentSiiAccountCatalogService } from "../../sii-account-plan/services/current-sii-account-catalog.service";
import { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
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
import { CompanyAccountMappingHistoryEntity } from "../../accounting/entities/company-account-mapping-history.entity";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { TaxPeriodEntity } from "../../accounting/entities/tax-period.entity";
import type { AccountLearningEvidence } from "../account-matching.types";
import { CatalogReferenceResolverService } from "./catalog-reference-resolver.service";
import { resolveCuratedCatalogKnowledge } from "../data/resolve-curated-catalog-knowledge";
import { inferBasicAccountFamily } from "../metadata/basic-account-family";
import {
  defaultHomologationReportPath,
  type HomologationAccountReport,
  writeHomologationReport,
} from "./homologation-report";
export { ACCOUNT_SUGGESTION_CONFIG } from "../account-suggestion.config";

const EXACT_TERM_SIGNAL =
  /^exact_(alias|official_name|company_alias|erp_term|industry_term|manual_term|abbreviation)$/;

type BalanceContext = {
  assetAmount: string;
  liabilityAmount: string;
  lossAmount: string;
  gainAmount: string;
  debitBalance: string;
  creditBalance: string;
};

type PeriodMatchingContext = BalanceContext & {
  accountNameSnapshot: string;
};

type AccountWithContext = CompanyAccountEntity & {
  matchingContext?: PeriodMatchingContext;
};

type DiscardReason =
  | "below_minimum_score"
  | "ambiguous_candidates"
  | "no_positive_terms"
  | "all_candidates_penalized"
  | "confirmed_mapping"
  | "unsupported_term_type"
  | "insufficient_semantic_evidence";

@Injectable()
export class AccountSuggestionService {
  private readonly logger = new Logger(AccountSuggestionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly candidateGenerator: AccountCandidateGeneratorService = new AccountCandidateGeneratorService(),
    private readonly ranking: AccountSuggestionRankingService = new AccountSuggestionRankingService(),
    @Optional()
    private readonly currentCatalog?: CurrentSiiAccountCatalogService,
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
    const siiAccounts = await this.loadSiiAccounts();
    const catalogResolver = new CatalogReferenceResolverService(
      this.dataSource,
    );
    const resolvedReferences = await catalogResolver.resolve({
      terms: loadedTerms,
      concepts: loadedConcepts,
      knowledge: loadedKnowledge,
      learning: loadedLearning,
      currentAccounts: siiAccounts,
    });
    const curatedKnowledge = resolveCuratedCatalogKnowledge(siiAccounts);
    const expenseKnowledge = resolveCatalogExpenseKnowledge(siiAccounts);
    const siiAccountsById = new Map(
      siiAccounts.map((account) => [account.id, account]),
    );
    const historicalMappings = await this.loadHistoricalCompanyMappings(
      accounts.map((account) => account.id),
    );
    const orphanReferences = [
      ...resolvedReferences.orphans,
      ...curatedKnowledge.missingCodes.map((code) => ({
        source: "term" as const,
        siiAccountId: "",
        stableCode: code,
        detail: "curated_code_missing_from_active_catalog",
      })),
    ];
    const homologationReport: HomologationAccountReport[] = [];
    if (orphanReferences.length) {
      this.logger.error({
        message:
          "Referencias SII huérfanas detectadas antes de generar sugerencias",
        orphanCount: orphanReferences.length,
        remappedCount: resolvedReferences.remappedCount,
        orphans: orphanReferences,
        curatedMissingCodes: curatedKnowledge.missingCodes,
      });
    }

    const diagnostics = {
      accountsProcessed: accounts.length,
      mappingsReused: 0,
      termsLoaded: resolvedReferences.terms.length,
      globalTermsLoaded: resolvedReferences.terms.filter(
        (term) => term.scope === "global",
      ).length,
      companyTermsLoaded: resolvedReferences.terms.filter(
        (term) => term.scope === "company",
      ).length,
      siiAccountIdsRequested: resolvedReferences.terms.length,
      siiAccountsFound: siiAccounts.length,
      siiAccountIdsMissing: orphanReferences.length,
      remappedCatalogReferences: resolvedReferences.remappedCount,
      orphanReferences,
      curatedMissingCodes: curatedKnowledge.missingCodes,
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
            concepts: resolvedReferences.concepts
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
            status: In([
              CompanyAccountSuggestionStatus.ACTIVE,
              CompanyAccountSuggestionStatus.REVIEW,
            ]),
          },
          { status: CompanyAccountSuggestionStatus.SUPERSEDED },
        );

        const generatedCandidates = this.candidateGenerator.generate(
          siiAccounts,
          resolvedReferences.terms,
          resolvedReferences.concepts,
          resolvedReferences.knowledge,
          resolvedReferences.learning,
        );
        const observedAccountName =
          companyAccount.matchingContext?.accountNameSnapshot ??
          companyAccount.name;
        const inferredBasicFamily = inferBasicAccountFamily(
          observedAccountName,
          {
            observedSection: undefined,
            balanceContext: companyAccount.matchingContext,
          },
        );
        const deterministic = this.ranking.rank(
          {
            observedAccountName,
            canonicalAccountName: companyAccount.name,
          },
          generatedCandidates,
          companyAccount.matchingContext,
          loadedRules,
          {
            historicalCompanyMappingSiiAccountId:
              historicalMappings.get(companyAccount.id) ?? null,
            inferredBasicFamily,
          },
        );
        const winner = deterministic.candidates[0];
        const second = deterministic.candidates[1];
        const normalizedObserved = normalizeAccountTerm(observedAccountName);
        const orphanForAccount =
          orphanReferences.find(
            (orphan) =>
              orphan.detail === normalizedObserved ||
              orphan.detail === observedAccountName,
          ) ??
          orphanReferences.find((orphan) =>
            resolvedReferences.terms.some(
              (term) =>
                term.normalizedTerm === normalizedObserved &&
                term.siiAccountId === orphan.siiAccountId,
            ),
          ) ??
          null;
        homologationReport.push({
          accountCode: companyAccount.internalCode,
          accountName: observedAccountName,
          observedSection: deterministic.observedSection,
          inferredFamily:
            deterministic.inferredBasicFamily ?? inferredBasicFamily,
          winnerCode: winner?.account.code ?? null,
          winnerName: winner?.account.name ?? null,
          score: winner?.score ?? null,
          confidence: winner?.confidence ?? null,
          decision: deterministic.decision,
          reasons: winner?.reasons ?? [],
          secondCandidate: second
            ? {
                code: second.account.code,
                name: second.account.name,
                score: second.score,
                confidence: second.confidence,
              }
            : null,
          absoluteGap: winner ? winner.score - (second?.score ?? 0) : null,
          orphanReferenceDetected: orphanForAccount,
        });
        this.logSuggestionAudit({
          companyAccount,
          industryId: company.industryId,
          loadedTerms,
          loadedConcepts,
          loadedLearning,
          generatedCandidates,
          ranking: deterministic,
          siiAccountsById,
        });
        const generatedAt = new Date();
        if (diagnosticsEnabled)
          await diagnosticRepository.save(
            diagnosticRepository.create({
              companyId,
              taxPeriodId,
              companyAccountId: companyAccount.id,
              accountName: observedAccountName,
              normalizedName: normalizeAccountTerm(observedAccountName),
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
            exact: candidate.reasons.some((reason) =>
              EXACT_TERM_SIGNAL.test(reason.signal),
            ),
          })),
          exactMatches: deterministic.candidates.filter((candidate) =>
            candidate.reasons.some((reason) =>
              EXACT_TERM_SIGNAL.test(reason.signal),
            ),
          ).length,
          discardedByScore:
            deterministic.decision === "review"
              ? deterministic.candidates.length
              : 0,
          discardReason:
            deterministic.decision === "ambiguous"
              ? ("ambiguous_candidates" as const)
              : deterministic.candidates.length === 0 &&
                  deterministic.semanticRejectedCandidates.length > 0
                ? ("insufficient_semantic_evidence" as const)
                : undefined,
        };
        /* Retrieval, hard compatibility and scoring finish before persistence.
           Review candidates stay visible but are never marked as active. */
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
              status:
                deterministic.decision === "review"
                  ? CompanyAccountSuggestionStatus.REVIEW
                  : CompanyAccountSuggestionStatus.ACTIVE,
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

    const reportPath = defaultHomologationReportPath(companyId, taxPeriodId);
    writeHomologationReport(homologationReport, reportPath);

    return {
      ...diagnostics,
      averageConfidence: diagnostics.suggestionsCreated
        ? diagnostics.averageConfidence / diagnostics.suggestionsCreated
        : 0,
      suggested: diagnostics.suggestionsCreated,
      homologationReport,
      homologationReportPath: reportPath,
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

  private loadSiiAccounts() {
    return (
      this.currentCatalog ??
      new CurrentSiiAccountCatalogService(this.dataSource)
    ).findAccounts();
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
            .update(
              normalizeAccountTerm(
                account.matchingContext?.accountNameSnapshot ?? account.name,
              ),
              "utf8",
            )
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

  /**
   * Temporary, deliberately verbose audit trace. It only reports data already
   * loaded by the production pipeline and therefore cannot affect retrieval,
   * scoring or persistence.
   */
  private logSuggestionAudit(input: {
    companyAccount: AccountWithContext;
    industryId: string | null;
    loadedTerms: SiiAccountTermEntity[];
    loadedConcepts: SiiAccountConceptEntity[];
    loadedLearning: AccountLearningEvidence[];
    generatedCandidates: ReturnType<
      AccountCandidateGeneratorService["generate"]
    >;
    ranking: ReturnType<AccountSuggestionRankingService["rank"]>;
    siiAccountsById: Map<string, SiiAccountEntity>;
  }) {
    const observedName =
      input.companyAccount.matchingContext?.accountNameSnapshot ??
      input.companyAccount.name;
    const canonicalName = input.companyAccount.name;
    const normalized = normalizeAccountTerm(observedName);
    const normalizedNameHash = createHash("sha256")
      .update(normalized, "utf8")
      .digest("hex");
    const exactTerms = input.loadedTerms.filter(
      (term) => term.normalizedTerm === normalized,
    );
    const exactLearning = input.loadedLearning.filter(
      (item) => item.normalizedNameHash === normalizedNameHash,
    );
    const candidateById = new Map(
      input.generatedCandidates.map((item) => [item.account.id, item]),
    );
    const describeTerm = (term: SiiAccountTermEntity) => ({
      siiAccountId: term.siiAccountId,
      code: input.siiAccountsById.get(term.siiAccountId)?.code,
      destination: input.siiAccountsById.get(term.siiAccountId)?.name,
      term: term.term,
      normalizedTerm: term.normalizedTerm,
      type: term.type,
      scope: term.scope,
      companyId: term.companyId,
      weight: Number(term.weight),
    });
    const structuralSignals = new Set([
      "balance_match",
      "balance_nature_match",
      "debit_balance",
      "credit_balance",
      "compatible_statement_section",
    ]);
    const describeCandidate = (
      item: (typeof input.ranking.allCandidates)[number],
    ) => ({
      siiAccountId: item.account.id,
      code: item.account.code,
      destination: item.account.name,
      statementSection: item.metadata.statementSection,
      statementSectionSource: item.metadata.statementSectionSource,
      score: item.score,
      confidence: item.confidence,
      semanticEvidenceSatisfied: item.semanticEvidenceSatisfied,
      semanticEvidenceStrong: item.semanticEvidenceStrong,
      semanticEvidenceReasons: item.semanticEvidenceReasons,
      learningHits: (item.learning ?? []).filter(
        (learning) => learning.normalizedNameHash === normalizedNameHash,
      ).length,
      officialNameHits: [item.account.name, ...item.terms]
        .map((value) =>
          typeof value === "string"
            ? value
            : value.type === "official_name"
              ? value.term
              : "",
        )
        .filter((value) => normalizeAccountTerm(value) === normalized).length,
      aliasHits: item.terms.filter(
        (term) =>
          term.type !== "official_name" && term.normalizedTerm === normalized,
      ).length,
      semanticEvidence: item.reasons.filter(
        (reason) =>
          item.semanticEvidenceReasons.includes(reason.signal) &&
          !structuralSignals.has(reason.signal),
      ),
      structuralEvidence: item.reasons.filter((reason) =>
        structuralSignals.has(reason.signal),
      ),
    });
    const beforeSemanticFilter = input.ranking.allCandidates
      .slice(0, ACCOUNT_SUGGESTION_CONFIG.topCandidates)
      .map(describeCandidate);
    const afterSemanticFilter = input.ranking.candidates
      .slice(0, ACCOUNT_SUGGESTION_CONFIG.topCandidates)
      .map(describeCandidate);
    const discarded = input.ranking.discardedCandidates
      .slice(0, ACCOUNT_SUGGESTION_CONFIG.topCandidates)
      .map((item) => {
        const candidate = candidateById.get(item.accountId);
        return {
          ...item,
          code: candidate?.account.code,
          destination: candidate?.account.name,
        };
      });
    this.logger.debug({
      message: "Auditoría temporal detallada de sugerencia de homologación",
      account: observedName,
      observedName,
      canonicalName,
      companyAccountId: input.companyAccount.id,
      companyId: input.companyAccount.companyId,
      industryId: input.industryId,
      normalized,
      normalizedNameHash,
      observedSection: input.ranking.observedSection,
      evidenceSources: {
        exactOfficialNames: [
          ...input.generatedCandidates
            .filter(
              (candidate) =>
                normalizeAccountTerm(candidate.account.name) === normalized,
            )
            .map((candidate) => ({
              siiAccountId: candidate.account.id,
              code: candidate.account.code,
              destination: candidate.account.name,
              term: candidate.account.name,
              normalizedTerm: normalizeAccountTerm(candidate.account.name),
              type: "official_name",
              scope: "catalog",
              companyId: null,
              weight: ACCOUNT_SUGGESTION_CONFIG.weights.exactOfficialName,
            })),
          ...exactTerms
            .filter((term) => term.type === "official_name")
            .map(describeTerm),
        ],
        exactAliases: exactTerms
          .filter((term) => term.type !== "official_name")
          .map(describeTerm),
        concepts: input.loadedConcepts
          .filter((concept) =>
            normalized.includes(
              normalizeAccountTerm(
                concept.normalizedConcept || concept.concept,
              ),
            ),
          )
          .map((concept) => ({
            siiAccountId: concept.siiAccountId,
            code: input.siiAccountsById.get(concept.siiAccountId)?.code,
            destination: input.siiAccountsById.get(concept.siiAccountId)?.name,
            concept: concept.concept,
            conceptType: concept.conceptType,
          })),
        learningGlobal: exactLearning.map((item) => ({
          siiAccountId: item.siiAccountId,
          code: input.siiAccountsById.get(item.siiAccountId)?.code,
          destination: input.siiAccountsById.get(item.siiAccountId)?.name,
          confirmationCount: item.confirmationCount,
          expertConfirmationCount: item.expertConfirmationCount,
          distinctCompanyCount: item.distinctCompanyCount,
          agreementRate: Number(item.agreementRate),
          confidence: Number(item.confidence),
        })),
        learningIndustry: exactLearning.flatMap((item) =>
          item.industryEvidence
            ? [
                {
                  siiAccountId: item.siiAccountId,
                  code: input.siiAccountsById.get(item.siiAccountId)?.code,
                  destination: input.siiAccountsById.get(item.siiAccountId)
                    ?.name,
                  industryId: item.industryEvidence.industryId,
                  confirmationCount: item.industryEvidence.confirmationCount,
                  expertConfirmationCount:
                    item.industryEvidence.expertConfirmationCount,
                  distinctCompanyCount:
                    item.industryEvidence.distinctCompanyCount,
                  agreementRate: Number(item.industryEvidence.agreementRate),
                  confidence: Number(item.industryEvidence.confidence),
                },
              ]
            : [],
        ),
        confirmationsDirectlyQueried: false,
        deterministicRules: input.ranking.evaluatedRules,
      },
      candidatesEnteringPipeline: input.generatedCandidates.length,
      pipelineCounts: {
        catalogueAccountsEvaluated: input.generatedCandidates.length,
        discardedByRetrieval: 0,
        discardedByHardFilters: input.ranking.discardedCandidates.length,
        discardedByScore: input.ranking.allCandidates.filter(
          (candidate) =>
            candidate.score < ACCOUNT_SUGGESTION_CONFIG.minimumSuggestionScore,
        ).length,
        discardedByConfidence: input.ranking.allCandidates.filter(
          (candidate) =>
            candidate.score >=
              ACCOUNT_SUGGESTION_CONFIG.minimumSuggestionScore &&
            candidate.confidence <
              ACCOUNT_SUGGESTION_CONFIG.minimumAutomaticConfidence,
        ).length,
        discardedByInsufficientEvidence:
          input.ranking.semanticRejectedCandidates.length,
      },
      topCandidatesBeforeSemanticFilter: beforeSemanticFilter,
      topCandidatesAfterSemanticFilter: afterSemanticFilter,
      candidatesDiscardedByHardFilters: discarded,
      hardDiscardedCandidateCount: input.ranking.discardedCandidates.length,
      finalDecision: input.ranking.decision,
      reviewPersistence: afterSemanticFilter.length
        ? input.ranking.decision === "review"
          ? "persisted_review_semantic_evidence_satisfied"
          : "persisted_semantic_evidence_satisfied"
        : "discarded_insufficient_semantic_evidence",
      winner: afterSemanticFilter[0] ?? null,
      finalDecisionAudit: input.ranking.decisionAudit,
    });
  }

  private async loadHistoricalCompanyMappings(companyAccountIds: string[]) {
    if (
      !companyAccountIds.length ||
      typeof this.dataSource.getRepository !== "function"
    )
      return new Map<string, string>();
    const rows = await this.dataSource
      .getRepository(CompanyAccountMappingHistoryEntity)
      .createQueryBuilder("history")
      .where("history.companyAccountId IN (:...ids)", {
        ids: companyAccountIds,
      })
      .andWhere("history.newStatus = :status", {
        status: CompanyAccountMappingStatus.CONFIRMED,
      })
      .andWhere("history.newSiiAccountId IS NOT NULL")
      .orderBy("history.createdAt", "DESC")
      .getMany();
    const byAccount = new Map<string, string>();
    for (const row of rows) {
      if (!byAccount.has(row.companyAccountId) && row.newSiiAccountId)
        byAccount.set(row.companyAccountId, row.newSiiAccountId);
    }
    return byAccount;
  }

  private discard(
    counts: Record<DiscardReason, number>,
    reason: DiscardReason,
  ) {
    counts[reason] = (counts[reason] ?? 0) + 1;
  }
}

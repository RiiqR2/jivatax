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
    const startedAt = Date.now();
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
    const confirmedMappingCount = accounts.filter(
      (account) =>
        account.mapping?.status === CompanyAccountMappingStatus.CONFIRMED,
    ).length;
    const industryLearningCount = loadedLearning.filter(
      (item) => item.industryEvidence,
    ).length;
    this.logger.log({
      event: "account_suggestion_generation_started",
      companyId,
      taxPeriodId,
      requestedAccountCount: accounts.length,
      companyIndustryId: company.industryId,
      algorithmVersion: ACCOUNT_SUGGESTION_CONFIG.algorithmVersion,
    });
    this.logger.debug({
      event: "account_suggestion_evidence_loaded",
      companyId,
      taxPeriodId,
      siiAccountCount: siiAccounts.length,
      curatedTermCount: loadedTerms.filter((term) => term.scope === "global")
        .length,
      conceptCount: loadedConcepts.length,
      companyAliasCount: loadedTerms.filter((term) => term.scope === "company")
        .length,
      knowledgeCount: loadedKnowledge.length,
      ruleCount: loadedRules.length,
      globalLearningConsulted: accounts.length > 0,
      globalLearningCount: loadedLearning.length,
      industryLearningConsulted: Boolean(
        company.industryId && loadedLearning.length,
      ),
      industryLearningSkippedReason: !company.industryId
        ? "company_without_industry"
        : loadedLearning.length === 0
          ? "no_global_learning_matches"
          : null,
      industryLearningCount,
      confirmedMappingCount,
    });
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
        event: "account_suggestion_catalogue_references_missing",
        message: "No se encontraron todas las cuentas SII referenciadas",
        requestedAccountIds: accountResolution.requestedAccountIds,
        foundAccountIds: accountResolution.foundAccountIds,
        missingAccountIds: accountResolution.missingAccountIds,
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
    const executionCounts = {
      highConfidence: 0,
      mediumConfidence: 0,
      lowConfidence: 0,
      ambiguous: 0,
      noCandidate: 0,
      belowThreshold: 0,
      globalLearningMatches: 0,
      industryLearningMatches: 0,
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
        const normalizedName = normalizeAccountTerm(companyAccount.name);
        const normalizedNameHash = createHash("sha256")
          .update(normalizedName, "utf8")
          .digest("hex");
        this.logger.debug({
          event: "account_suggestion_account_started",
          companyAccountId: companyAccount.id,
          internalAccountCode: companyAccount.internalCode,
          originalName: companyAccount.name,
          normalizedName,
          normalizedNameHash,
          balanceSection: this.balanceSection(companyAccount.matchingContext),
          existingMappingId: companyAccount.mapping?.id ?? null,
        });
        if (
          companyAccount.mapping?.status ===
          CompanyAccountMappingStatus.CONFIRMED
        ) {
          this.discard(
            diagnostics.withoutSuggestionReasons,
            "confirmed_mapping",
          );
          diagnostics.mappingsReused++;
          this.logDecision(companyAccount.id, "skipped_confirmed_mapping");
          continue;
        }

        const accountLearning = loadedLearning.filter(
          (item) => item.normalizedNameHash === normalizedNameHash,
        );
        const industryMatches = accountLearning.filter(
          (item) => item.industryEvidence,
        );
        if (accountLearning.length) executionCounts.globalLearningMatches++;
        if (industryMatches.length) executionCounts.industryLearningMatches++;
        this.logger.debug({
          event: "account_suggestion_learning_lookup",
          companyAccountId: companyAccount.id,
          normalizedNameHash,
          globalLearningConsulted: true,
          globalLearningMatched: accountLearning.length > 0,
          globalLearningCandidateCount: accountLearning.length,
          industryLearningConsulted: Boolean(
            company.industryId && loadedLearning.length,
          ),
          industryLearningMatched: industryMatches.length > 0,
          industryLearningCandidateCount: industryMatches.length,
          companyIndustryId: company.industryId,
          globalCandidates: accountLearning
            .slice(0, 5)
            .map((item) => this.learningSummary(item)),
          industryCandidates: industryMatches
            .slice(0, 5)
            .map((item) => this.industryLearningSummary(item)),
        });

        // Retire the previous active generation inside the same transaction.
        // A failed transaction restores it, while a successful no-match cannot
        // leave a stale suggestion looking approvable.
        const supersedeResult = await suggestionRepository.update(
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
        this.logCandidateRetrieval(
          companyAccount.id,
          siiAccounts.length,
          generatedCandidates,
          deterministic,
        );
        this.logRuleApplications(companyAccount.id, deterministic);
        this.logRanking(companyAccount.id, deterministic);
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
          executionCounts.belowThreshold++;
          this.logDecision(companyAccount.id, "below_threshold", deterministic);
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
            executionCounts.ambiguous++;
          if (ranked.discardReason === "ambiguous_candidates")
            diagnostics.candidatesDiscardedByAmbiguity +=
              ranked.candidates.length;
          diagnostics.withoutSuggestion++;
          this.logDecision(companyAccount.id, "ambiguous", deterministic);
          continue;
        }

        if (deterministic.decision === "no_candidate") {
          executionCounts.noCandidate++;
          this.logDecision(companyAccount.id, "no_candidate", deterministic);
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
        const persistedSuggestions =
          await suggestionRepository.save(suggestions);
        diagnostics.suggestionsCreated += suggestions.length;
        diagnostics.averageConfidence += suggestions.reduce(
          (sum, suggestion) => sum + Number(suggestion.confidence),
          0,
        );
        for (const suggestion of suggestions) {
          const confidence = Number(suggestion.confidence);
          if (confidence >= 0.8) executionCounts.highConfidence++;
          else if (confidence >= 0.55) executionCounts.mediumConfidence++;
          else executionCounts.lowConfidence++;
        }
        if (suggestions.length)
          this.logDecision(companyAccount.id, "persisted", deterministic);
        persistedSuggestions.forEach((suggestion) =>
          this.logger.debug({
            event: "account_suggestion_persisted",
            companyAccountId: companyAccount.id,
            suggestionId: suggestion.id ?? null,
            siiAccountId: suggestion.siiAccountId,
            rank: suggestion.suggestionRank,
            score: Number(suggestion.score),
            confidence: Number(suggestion.confidence),
            previousSuggestionSuperseded:
              typeof supersedeResult?.affected === "number"
                ? supersedeResult.affected > 0
                : null,
          }),
        );
      }
    });

    this.logger.log({
      event: "account_suggestion_generation_completed",
      companyId,
      taxPeriodId,
      evaluatedCount: accounts.length - diagnostics.mappingsReused,
      skippedConfirmedCount: diagnostics.mappingsReused,
      persistedCount: diagnostics.suggestionsCreated,
      highConfidenceCount: executionCounts.highConfidence,
      mediumConfidenceCount: executionCounts.mediumConfidence,
      lowConfidenceCount: executionCounts.lowConfidence,
      ambiguousCount: executionCounts.ambiguous,
      noCandidateCount: executionCounts.noCandidate,
      belowThresholdCount: executionCounts.belowThreshold,
      globalLearningMatchCount: executionCounts.globalLearningMatches,
      industryLearningMatchCount: executionCounts.industryLearningMatches,
      durationMs: Date.now() - startedAt,
    });

    return {
      ...diagnostics,
      averageConfidence: diagnostics.suggestionsCreated
        ? diagnostics.averageConfidence / diagnostics.suggestionsCreated
        : 0,
      suggested: diagnostics.suggestionsCreated,
    };
  }

  private learningSummary(item: AccountLearningEvidence) {
    return {
      siiAccountId: item.siiAccountId,
      confirmationCount: item.confirmationCount,
      expertConfirmationCount: item.expertConfirmationCount,
      distinctCompanyCount: item.distinctCompanyCount,
      agreementRate: Number(item.agreementRate),
      confidence: Number(item.confidence),
    };
  }

  private industryLearningSummary(item: AccountLearningEvidence) {
    const evidence = item.industryEvidence;
    return {
      siiAccountId: item.siiAccountId,
      confirmationCount: evidence?.confirmationCount ?? 0,
      expertConfirmationCount: evidence?.expertConfirmationCount ?? 0,
      distinctCompanyCount: evidence?.distinctCompanyCount ?? 0,
      agreementRate: Number(evidence?.agreementRate ?? 0),
      confidence: Number(evidence?.confidence ?? 0),
    };
  }

  private balanceSection(context?: BalanceContext) {
    if (!context) return "unknown";
    if (Number(context.assetAmount)) return "asset";
    if (Number(context.liabilityAmount)) return "liability_or_equity";
    if (Number(context.lossAmount)) return "expense";
    if (Number(context.gainAmount)) return "income";
    return "unknown";
  }

  private logCandidateRetrieval(
    companyAccountId: string,
    evaluatedCatalogueCount: number,
    generated: ReturnType<AccountCandidateGeneratorService["generate"]>,
    result: ReturnType<AccountSuggestionRankingService["rank"]>,
  ) {
    const signals = result.allCandidates.flatMap(
      (candidate) => candidate.reasons,
    );
    this.logger.debug({
      event: "account_suggestion_candidates_retrieved",
      companyAccountId,
      evaluatedCatalogueCount,
      initialCandidateCount: generated.length,
      rankedCandidateCount: result.allCandidates.length,
      candidateSourceSummary: {
        exactLexicalNameOrTerm: signals.filter(
          (reason) => reason.signal === "exact_alias",
        ).length,
        curatedTerms: generated.filter((candidate) => candidate.terms.length)
          .length,
        accountingConcepts: generated.filter(
          (candidate) => candidate.concepts.length,
        ).length,
        companyAliases: generated.filter((candidate) =>
          candidate.terms.some((term) => term.scope === "company"),
        ).length,
        jaccard: signals.filter((reason) => reason.signal === "jaccard").length,
        characterTrigrams: signals.filter(
          (reason) => reason.signal === "character_trigrams",
        ).length,
        globalLearning: signals.filter(
          (reason) => reason.signal === "supervised_learning_global",
        ).length,
        industryLearning: signals.filter(
          (reason) => reason.signal === "supervised_learning_industry",
        ).length,
        configuredKnowledge: generated.filter(
          (candidate) => candidate.knowledge,
        ).length,
      },
    });
  }

  private logRuleApplications(
    companyAccountId: string,
    result: ReturnType<AccountSuggestionRankingService["rank"]>,
  ) {
    for (const evaluation of result.ruleEvaluations) {
      for (const signal of evaluation.signals) {
        const ranked = result.allCandidates.find(
          (item) => item.account.id === evaluation.account.id,
        );
        const scoreAfter = ranked?.score ?? null;
        this.logger.debug({
          event: "account_suggestion_candidate_rule_applied",
          companyAccountId,
          siiAccountId: evaluation.account.id,
          siiAccountCode: evaluation.account.code,
          ruleCode: signal.ruleId ?? signal.signal,
          action: evaluation.excluded
            ? "excluded"
            : evaluation.review
              ? "forced_review"
              : signal.points > 0
                ? "boosted"
                : signal.points < 0
                  ? "penalized"
                  : "observed",
          scoreBefore:
            scoreAfter == null || evaluation.excluded
              ? null
              : scoreAfter - signal.points,
          scoreAfter,
          explanation: signal.description,
        });
      }
    }
    for (const discarded of result.discardedCandidates) {
      for (const reason of discarded.reasons) {
        if (reason === "excluded_by_rule") continue;
        const account = result.ruleEvaluations.find(
          (item) => item.account.id === discarded.accountId,
        )?.account;
        this.logger.debug({
          event: "account_suggestion_candidate_rule_applied",
          companyAccountId,
          siiAccountId: discarded.accountId,
          siiAccountCode: account?.code ?? null,
          ruleCode: reason,
          action: "excluded",
          scoreBefore: null,
          scoreAfter: null,
          explanation: reason,
        });
      }
    }
  }

  private logRanking(
    companyAccountId: string,
    result: ReturnType<AccountSuggestionRankingService["rank"]>,
  ) {
    const first = result.candidates[0];
    const second = result.candidates[1];
    this.logger.debug({
      event: "account_suggestion_ranking_completed",
      companyAccountId,
      candidateCount: result.allCandidates.length,
      ambiguous: result.decision === "ambiguous",
      scoreGap: first ? first.score - (second?.score ?? 0) : null,
      candidates: result.candidates.slice(0, 5).map((candidate, index) => ({
        rank: index + 1,
        siiAccountId: candidate.account.id,
        siiAccountCode: candidate.account.code,
        score: candidate.score,
        confidence: candidate.confidence,
        evidence: candidate.reasons
          .filter((reason) => reason.points >= 0)
          .map((reason) => reason.signal),
        penalties: candidate.reasons
          .filter((reason) => reason.points < 0)
          .map((reason) => reason.signal),
        exclusions: [],
        globalLearningConfidence: candidate.reasons.some(
          (reason) => reason.signal === "supervised_learning_global",
        )
          ? (candidate.learning?.[0]?.confidence ?? null)
          : null,
        industryLearningConfidence:
          candidate.learning?.find((item) => item.industryEvidence)
            ?.industryEvidence?.confidence ?? null,
      })),
    });
  }

  private logDecision(
    companyAccountId: string,
    decision:
      | "persisted"
      | "skipped_confirmed_mapping"
      | "below_threshold"
      | "ambiguous"
      | "no_candidate",
    result?: ReturnType<AccountSuggestionRankingService["rank"]>,
  ) {
    const selected = result?.candidates[0];
    const reasonCode =
      decision !== "below_threshold"
        ? decision
        : result?.reviewRequiredByRule
          ? "review_required_by_rule"
          : selected?.metadata.statementSection === "unknown"
            ? "unknown_candidate_classification"
            : selected &&
                selected.score <
                  ACCOUNT_SUGGESTION_CONFIG.minimumSuggestionScore
              ? "below_minimum_score"
              : "below_minimum_confidence";
    this.logger.debug({
      event: "account_suggestion_decision",
      companyAccountId,
      decision,
      reasonCode,
      selectedSiiAccountId: selected?.account.id ?? null,
      selectedSiiAccountCode: selected?.account.code ?? null,
      selectedScore: selected?.score ?? null,
      selectedConfidence: selected?.confidence ?? null,
      ambiguous: result?.decision === "ambiguous",
      persistenceThreshold: {
        minimumScore: ACCOUNT_SUGGESTION_CONFIG.minimumSuggestionScore,
        minimumConfidence: ACCOUNT_SUGGESTION_CONFIG.minimumAutomaticConfidence,
        minimumAbsoluteDifference:
          ACCOUNT_SUGGESTION_CONFIG.minimumAbsoluteDifference,
        minimumRelativeDifference:
          ACCOUNT_SUGGESTION_CONFIG.minimumRelativeDifference,
      },
      confidenceClassification: selected
        ? selected.confidence >= 0.8
          ? "high"
          : selected.confidence >= 0.55
            ? "medium"
            : "low"
        : null,
    });
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

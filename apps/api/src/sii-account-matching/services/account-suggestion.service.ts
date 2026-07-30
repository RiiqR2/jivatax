import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { Brackets, DataSource, In } from "typeorm";
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
} from "../normalization/account-term-normalizer";

/** Scores are points (not percentages); confidence is always in the 0..1 range. */
export const ACCOUNT_SUGGESTION_CONFIG = Object.freeze({
  algorithmVersion: "deterministic-v3",
  minimumSuggestionScore: 45,
  ambiguityMinimumDifference: 5,
  scoreForFullConfidence: 75,
  topCandidates: 3,
  confidence: { high: 0.8, medium: 0.55 },
  partialScore: 15,
  tokenSimilarityScore: 32,
  companyAliasScore: 90,
  lexicalCandidateThreshold: 0.34,
  ambiguityRelativeDifference: 0.12,
});

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

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async generateForPeriod(companyId: string, taxPeriodId: string) {
    const accounts = await this.loadCompanyAccounts(companyId, taxPeriodId);
    const loadedTerms = await this.loadTerms(companyId);
    const { positiveTermsByNormalizedTerm } =
      this.buildTermIndexes(loadedTerms);
    const siiAccountIds = Array.from(
      new Set(loadedTerms.map((term) => term.siiAccountId)),
    );
    const siiAccounts = await this.loadSiiAccounts(siiAccountIds);
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
      suggestionsCreated: 0,
      withoutSuggestion: 0,
      withoutSuggestionReasons: {} as Record<DiscardReason, number>,
      algorithmVersion: ACCOUNT_SUGGESTION_CONFIG.algorithmVersion,
      averageConfidence: 0,
    };

    await this.dataSource.transaction(async (manager) => {
      const suggestionRepository = manager.getRepository(
        CompanyAccountSuggestionEntity,
      );
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

        const normalizedName = normalizeAccountTerm(companyAccount.name);
        const exactTerms =
          positiveTermsByNormalizedTerm.get(normalizedName) ?? [];
        const lexicalTerms = loadedTerms.filter((term) => {
          if (!POSITIVE_TERM_TYPES.has(term.type) || exactTerms.includes(term))
            return false;
          return (
            this.tokenSimilarity(normalizedName, term.normalizedTerm) >=
            ACCOUNT_SUGGESTION_CONFIG.lexicalCandidateThreshold
          );
        });
        const matchedTerms = [...exactTerms, ...lexicalTerms];
        const matchedNegativeTerms = loadedTerms.filter(
          (term) =>
            term.type === "negative_term" &&
            this.termOccurs(normalizedName, term.normalizedTerm),
        );
        const ranked = this.rank(
          siiAccountsById,
          matchedTerms,
          matchedNegativeTerms,
          normalizedName,
        );
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

        const generatedAt = new Date();
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

  private loadCompanyAccounts(companyId: string, taxPeriodId: string) {
    return this.dataSource
      .getRepository(CompanyAccountEntity)
      .createQueryBuilder("account")
      .innerJoin(
        TaxPeriodCompanyAccountEntity,
        "periodAccount",
        "periodAccount.companyAccountId = account.id AND periodAccount.companyId = :companyId AND periodAccount.taxPeriodId = :taxPeriodId",
        { companyId, taxPeriodId },
      )
      .leftJoinAndSelect("account.mapping", "mapping")
      .where("account.companyId = :companyId", { companyId })
      .andWhere("account.deletedAt IS NULL")
      .distinct(true)
      .getMany();
  }

  private loadSiiAccounts(siiAccountIds: string[]) {
    if (!siiAccountIds.length) return Promise.resolve([]);
    return this.dataSource.getRepository(SiiAccountEntity).find({
      where: { id: In(siiAccountIds) },
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

  private rank(
    siiAccountsById: Map<string, SiiAccountEntity>,
    positiveTerms: SiiAccountTermEntity[],
    negativeTerms: SiiAccountTermEntity[],
    normalizedName?: string,
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
          if (
            normalizedName &&
            similarity < ACCOUNT_SUGGESTION_CONFIG.lexicalCandidateThreshold
          )
            continue;
          positiveTermsSeen++;
          const isExact =
            !normalizedName || normalizedName === term.normalizedTerm;
          if (isExact) exactMatches++;
          exact ||= isExact;
          reasons.push({
            signal:
              isExact && term.scope === "company"
                ? "exact_company_alias"
                : isExact
                  ? `exact_${term.type}`
                  : "token_similarity",
            description: isExact
              ? `Coincidencia exacta con ${term.type}: ${term.term}`
              : `Similitud de tokens (${Math.round(similarity * 100)}%) con: ${term.term}`,
            points: isExact
              ? term.scope === "company"
                ? Math.max(weight, ACCOUNT_SUGGESTION_CONFIG.companyAliasScore)
                : weight
              : Math.round(
                  ACCOUNT_SUGGESTION_CONFIG.tokenSimilarityScore * similarity,
                ),
          });
        }
      }
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
          (difference < ACCOUNT_SUGGESTION_CONFIG.ambiguityMinimumDifference ||
            relativeDifference <
              ACCOUNT_SUGGESTION_CONFIG.ambiguityRelativeDifference)
        ? "ambiguous_candidates"
        : undefined;
    return {
      candidates,
      exactMatches,
      discardedByScore,
      debugTerms,
      discardReason,
    };
  }

  private tokenSimilarity(left: string, right: string): number {
    const leftWords = relevantWords(left);
    const rightWords = relevantWords(right);
    if (!leftWords.size || !rightWords.size) return 0;
    const intersection = [...leftWords].filter((word) =>
      rightWords.has(word),
    ).length;
    const union = new Set([...leftWords, ...rightWords]).size;
    return intersection / union;
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

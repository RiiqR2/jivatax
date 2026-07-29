import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { Brackets, DataSource } from "typeorm";
import {
  CompanyAccountSuggestionEntity,
  CompanyAccountSuggestionStatus,
} from "../../accounting/entities/company-account-suggestion.entity";
import { TaxPeriodCompanyAccountEntity } from "../../accounting/entities/tax-period-company-account.entity";
import { CompanyAccountEntity } from "../../company-account-plan/entities/company-account.entity";
import { CompanyAccountMappingStatus } from "../../company-account-plan/enums/company-account-plan.enums";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionStatus } from "../../sii-account-plan/enums/sii-account-plan-version-status.enum";
import {
  SiiAccountTermEntity,
  type SiiAccountTermType,
} from "../entities/sii-account-term.entity";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";

/** Scores are points (not percentages); confidence is always in the 0..1 range. */
export const ACCOUNT_SUGGESTION_CONFIG = Object.freeze({
  algorithmVersion: "deterministic-v2",
  minimumSuggestionScore: 45,
  ambiguityMinimumDifference: 5,
  scoreForFullConfidence: 75,
  topCandidates: 3,
  confidence: { high: 0.8, medium: 0.55 },
  partialScore: 15,
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
    const siiAccounts = await this.loadSiiAccounts();
    const terms = await this.loadTerms(companyId);
    const termIndexes = this.buildTermIndexes(terms);

    const diagnostics = {
      processed: accounts.length,
      termsLoaded: terms.length,
      globalTermsLoaded: terms.filter((term) => term.scope === "global").length,
      companyTermsLoaded: terms.filter((term) => term.scope === "company")
        .length,
      exactMatchesFound: 0,
      candidatesGenerated: 0,
      candidatesDiscardedByScore: 0,
      candidatesDiscardedByAmbiguity: 0,
      suggestionsCreated: 0,
      withoutSuggestion: 0,
      withoutSuggestionReasons: {} as Record<DiscardReason, number>,
      algorithmVersion: ACCOUNT_SUGGESTION_CONFIG.algorithmVersion,
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
          diagnostics.withoutSuggestion++;
          continue;
        }

        const normalizedName = normalizeAccountTerm(companyAccount.name);
        const ranked = this.rank(normalizedName, siiAccounts, termIndexes);
        diagnostics.exactMatchesFound += ranked.exactMatches;
        diagnostics.candidatesGenerated += ranked.candidates.length;
        diagnostics.candidatesDiscardedByScore += ranked.discardedByScore;

        if (normalizedName === "caja") {
          this.logger.debug({
            normalizedName,
            terms: ranked.debugTerms,
            candidates: ranked.candidates.map(
              ({ account, score, confidence }) => ({
                siiAccountId: account.id,
                score,
                confidence,
              }),
            ),
            threshold: ACCOUNT_SUGGESTION_CONFIG.minimumSuggestionScore,
            decision: ranked.discardReason ?? "persist",
          });
        }

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

        await suggestionRepository.update(
          {
            companyAccountId: companyAccount.id,
            status: CompanyAccountSuggestionStatus.ACTIVE,
          },
          { status: CompanyAccountSuggestionStatus.SUPERSEDED },
        );
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
      }
    });

    return { ...diagnostics, suggested: diagnostics.suggestionsCreated };
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

  private loadSiiAccounts() {
    return this.dataSource
      .getRepository(SiiAccountEntity)
      .createQueryBuilder("account")
      .innerJoin("account.version", "version")
      .where("account.deletedAt IS NULL")
      .andWhere("version.deletedAt IS NULL")
      .andWhere("version.status = :status", {
        status: SiiAccountPlanVersionStatus.ACTIVE,
      })
      .getMany();
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
    normalizedName: string,
    siiAccounts: SiiAccountEntity[],
    termIndexes: TermIndexes,
  ) {
    let exactMatches = 0;
    let discardedByScore = 0;
    let positiveTermsSeen = 0;
    let penalizedCandidates = 0;
    const debugTerms: Array<{ type: string; weight: number; term: string }> =
      [];
    const candidates: Candidate[] = [];

    const positiveTerms =
      termIndexes.positiveTermsByNormalizedTerm.get(normalizedName) ?? [];
    const negativeTerms =
      termIndexes.negativeTermsByNormalizedTerm.get(normalizedName) ?? [];
    const matchedTermsByAccount = new Map<string, SiiAccountTermEntity[]>();
    for (const term of [...positiveTerms, ...negativeTerms]) {
      const accountTerms = matchedTermsByAccount.get(term.siiAccountId) ?? [];
      accountTerms.push(term);
      matchedTermsByAccount.set(term.siiAccountId, accountTerms);
    }

    for (const account of siiAccounts) {
      const reasons: Candidate["reasons"] = [];
      let exact = false;
      for (const term of matchedTermsByAccount.get(account.id) ?? []) {
        const weight = Number(term.weight);
        debugTerms.push({ type: term.type, weight, term: term.term });
        if (term.type === "negative_term") {
          reasons.push({
            signal: "negative_term",
            description: `Penalización por término negativo: ${term.term}`,
            points: -Math.abs(weight),
          });
        } else if (POSITIVE_TERM_TYPES.has(term.type)) {
          positiveTermsSeen++;
          exactMatches++;
          exact = true;
          reasons.push({
            signal: `exact_${term.type}`,
            description: `Coincidencia exacta con ${term.type}: ${term.term}`,
            points: weight,
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
    const discardReason: DiscardReason | undefined = !candidates.length
      ? positiveTermsSeen === 0
        ? penalizedCandidates > 0
          ? "all_candidates_penalized"
          : "no_positive_terms"
        : "below_minimum_score"
      : candidates.length > 1 &&
          difference < ACCOUNT_SUGGESTION_CONFIG.ambiguityMinimumDifference
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

  private buildTermIndexes(terms: SiiAccountTermEntity[]): TermIndexes {
    const indexes: TermIndexes = {
      positiveTermsByNormalizedTerm: new Map(),
      negativeTermsByNormalizedTerm: new Map(),
    };
    for (const term of terms) {
      const index =
        term.type === "negative_term"
          ? indexes.negativeTermsByNormalizedTerm
          : POSITIVE_TERM_TYPES.has(term.type)
            ? indexes.positiveTermsByNormalizedTerm
            : undefined;
      if (!index) continue;

      // loadTerms() returns hydrated entities: use the TypeScript property,
      // never the physical normalized_term column name from a raw result.
      const normalizedTerm = term.normalizedTerm;
      const indexedTerms = index.get(normalizedTerm) ?? [];
      indexedTerms.push(term);
      index.set(normalizedTerm, indexedTerms);
    }
    return indexes;
  }

  private discard(
    counts: Record<DiscardReason, number>,
    reason: DiscardReason,
  ) {
    counts[reason] = (counts[reason] ?? 0) + 1;
  }
}

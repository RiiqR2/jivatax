import { Injectable } from "@nestjs/common";
import type {
  SuggestionCandidate,
  MatchingResolutionContext,
  MatchingResolutionResult,
  AccountObservation,
} from "./account-matching-pipeline.types";
import { AccountObservationClassifierService } from "./account-observation-classifier.service";
import { AccountingRuleResolverService } from "./accounting-rule-resolver.service";
import { CompatibleCandidateRankerService } from "./compatible-candidate-ranker.service";
import { ExactMappingResolverService } from "./exact-mapping-resolver.service";
import { SuggestionDecisionService } from "./suggestion-decision.service";
import { ConfirmedMappingResolverService } from "./confirmed-mapping-resolver.service";
import { HistoricalCompanyMappingResolverService } from "./historical-company-mapping-resolver.service";
import { CompanyAliasResolverService } from "./company-alias-resolver.service";
import { ExactCatalogTermResolverService } from "./exact-catalog-term-resolver.service";

/** Isolated test facade. It is deliberately not registered in the production module. */
@Injectable()
export class SiiAccountMatchingPipelineService {
  constructor(
    private readonly classifier = new AccountObservationClassifierService(),
    private readonly exact = new ExactMappingResolverService(),
    private readonly rules = new AccountingRuleResolverService(),
    private readonly ranker = new CompatibleCandidateRankerService(),
    private readonly decisions = new SuggestionDecisionService(),
    private readonly confirmed = new ConfirmedMappingResolverService(),
    private readonly historical = new HistoricalCompanyMappingResolverService(),
    private readonly companyAlias = new CompanyAliasResolverService(),
    private readonly catalogTerm = new ExactCatalogTermResolverService(),
  ) {}

  /** Deterministic v2 entry point. It consumes injected data and has no persistence. */
  resolve(context: MatchingResolutionContext): MatchingResolutionResult {
    const activeParentCodes = new Set(
      context.catalogAccounts
        .filter((account) => account.active !== false && account.parentCode)
        .map((account) => account.parentCode as string),
    );
    const catalogAccounts = context.catalogAccounts.map((account) => ({
      ...account,
      // Real catalogue relationships take precedence over absent or stale flags.
      isLeaf: activeParentCodes.has(account.code) ? false : account.isLeaf,
    }));
    const observation: AccountObservation =
      "normalizedName" in context.accountObservation
        ? context.accountObservation
        : this.classifier.classify(context.accountObservation);
    const applicableConfirmedMapping =
      context.confirmedMapping?.companyAccountId === context.companyAccountId
        ? context.confirmedMapping
        : undefined;
    if (applicableConfirmedMapping) {
      const current = this.confirmed.resolve(
        applicableConfirmedMapping,
        catalogAccounts,
      );
      if (current.length)
        return {
          decision: "strong",
          candidates: current,
          resolutionStatus: "resolved",
          warnings: [],
          autoConfirmed: false,
        };
      return {
        decision: "ambiguous",
        candidates: [],
        resolutionStatus: "confirmed_mapping_unresolved",
        warnings: ["confirmed_mapping_requires_manual_resolution"],
        unresolvedConfirmedMapping: {
          siiAccountId: applicableConfirmedMapping.siiAccountId,
          siiCode: applicableConfirmedMapping.siiCode,
          siiName: applicableConfirmedMapping.siiName,
        },
        autoConfirmed: false,
      };
    }
    const levels: SuggestionCandidate[][] = [
      this.historical.resolve(
        observation,
        context.companyAccountId,
        context.historicalCompanyMappings,
        catalogAccounts,
      ),
      this.companyAlias.resolve(
        observation,
        context.companyAliases,
        catalogAccounts,
      ),
      this.exact.resolve(observation, catalogAccounts),
      this.catalogTerm.resolve(
        observation,
        context.catalogTerms,
        catalogAccounts,
      ),
      this.rules.resolve(observation, catalogAccounts),
      this.ranker.rank(observation, catalogAccounts),
    ];
    // Every layer already returns one candidate per distinct destination
    // (never a duplicate for the same account), so the layer's own score
    // ordering is the only fair tie-break: an exact/rule layer with several
    // equally-scored destinations stays ambiguous on its own, while a
    // clearly superior ranked candidate is no longer forced into ambiguity
    // just because weaker alternatives also survived compatibility.
    const candidates = [
      ...(levels.find((level) => level.length > 0) ?? []),
    ].sort((left, right) => right.technicalScore - left.technicalScore);
    const decision = this.decisions.decide(candidates);
    return {
      decision,
      candidates,
      resolutionStatus:
        decision === "ambiguous"
          ? "ambiguous"
          : decision === "no_candidate"
            ? "no_candidate"
            : "resolved",
      warnings: [],
      autoConfirmed: false,
    };
  }
}

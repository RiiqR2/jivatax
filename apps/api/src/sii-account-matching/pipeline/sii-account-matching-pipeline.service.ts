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
        context.catalogAccounts,
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
        context.catalogAccounts,
      ),
      this.companyAlias.resolve(
        observation,
        context.companyAliases,
        context.catalogAccounts,
      ),
      this.exact.resolve(observation, context.catalogAccounts),
      this.catalogTerm.resolve(
        observation,
        context.catalogTerms,
        context.catalogAccounts,
      ),
      this.rules.resolve(observation, context.catalogAccounts),
      this.ranker.rank(observation, context.catalogAccounts),
    ];
    const candidates = levels.find((level) => level.length > 0) ?? [];
    const distinctDestinations = new Set(
      candidates.map((candidate) => candidate.siiAccountId),
    );
    const decision =
      distinctDestinations.size > 1
        ? "ambiguous"
        : this.decisions.decide(candidates);
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

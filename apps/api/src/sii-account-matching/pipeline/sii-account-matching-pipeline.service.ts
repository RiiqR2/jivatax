import { Injectable } from "@nestjs/common";
import type {
  PipelineCatalogAccount,
  AccountObservationInput,
  SuggestionCandidate,
  SuggestionDecision,
} from "./account-matching-pipeline.types";
import { AccountObservationClassifierService } from "./account-observation-classifier.service";
import { AccountingRuleResolverService } from "./accounting-rule-resolver.service";
import { CompatibleCandidateRankerService } from "./compatible-candidate-ranker.service";
import { ExactMappingResolverService } from "./exact-mapping-resolver.service";
import { SuggestionDecisionService } from "./suggestion-decision.service";

/** Isolated test facade. It is deliberately not registered in the production module. */
@Injectable()
export class SiiAccountMatchingPipelineService {
  constructor(
    private readonly classifier = new AccountObservationClassifierService(),
    private readonly exact = new ExactMappingResolverService(),
    private readonly rules = new AccountingRuleResolverService(),
    private readonly ranker = new CompatibleCandidateRankerService(),
    private readonly decisions = new SuggestionDecisionService(),
  ) {}

  suggest(
    input: AccountObservationInput | string,
    catalog: PipelineCatalogAccount[],
  ): { decision: SuggestionDecision; candidates: SuggestionCandidate[] } {
    const observation =
      typeof input === "string"
        ? this.classifier.classify(input)
        : this.classifier.classify(input);
    const exact = this.exact.resolve(observation, catalog);
    const candidates = exact.length
      ? exact
      : this.rules.resolve(observation, catalog);
    const resolved = candidates.length
      ? candidates
      : this.ranker.rank(observation, catalog);
    return { decision: this.decisions.decide(resolved), candidates: resolved };
  }
}

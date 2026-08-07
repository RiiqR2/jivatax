import { Injectable } from "@nestjs/common";
import type {
  AccountObservation,
  CatalogTermEvidence,
  PipelineCatalogAccount,
  SuggestionCandidate,
} from "./account-matching-pipeline.types";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";
import { evidenceCandidate } from "./resolver-support";

@Injectable()
export class ExactCatalogTermResolverService {
  constructor(
    private readonly compatibility = new AccountCompatibilityFilterService(),
  ) {}
  resolve(
    observation: AccountObservation,
    terms: CatalogTermEvidence[],
    catalog: PipelineCatalogAccount[],
  ): SuggestionCandidate[] {
    return terms
      .filter(
        (term) =>
          term.active &&
          term.type !== "negative_term" &&
          term.normalizedTerm === observation.normalizedName,
      )
      .flatMap((term) => {
        const candidate = evidenceCandidate(
          observation,
          term,
          catalog,
          this.compatibility,
          "exact_catalog_term",
          "strong",
          [`exact_catalog_term:${term.type}:${term.scope}`],
        );
        return candidate ? [candidate] : [];
      });
  }
}

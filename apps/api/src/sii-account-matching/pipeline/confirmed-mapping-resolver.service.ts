import { Injectable } from "@nestjs/common";
import type {
  AccountObservation,
  ConfirmedMappingEvidence,
  PipelineCatalogAccount,
  SuggestionCandidate,
} from "./account-matching-pipeline.types";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";
import { evidenceCandidate } from "./resolver-support";

@Injectable()
export class ConfirmedMappingResolverService {
  constructor(
    private readonly compatibility = new AccountCompatibilityFilterService(),
  ) {}
  resolve(
    observation: AccountObservation,
    mapping: ConfirmedMappingEvidence | undefined,
    catalog: PipelineCatalogAccount[],
  ): SuggestionCandidate[] {
    if (!mapping) return [];
    const candidate = evidenceCandidate(
      observation,
      mapping,
      catalog,
      this.compatibility,
      "confirmed_mapping",
      "strong",
      [`confirmed_mapping_reused:${mapping.source}`],
      true,
    );
    return candidate ? [candidate] : [];
  }
}

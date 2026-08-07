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
export class HistoricalCompanyMappingResolverService {
  constructor(
    private readonly compatibility = new AccountCompatibilityFilterService(),
  ) {}
  resolve(
    observation: AccountObservation,
    companyAccountId: string,
    mappings: ConfirmedMappingEvidence[],
    catalog: PipelineCatalogAccount[],
  ): SuggestionCandidate[] {
    return mappings
      .filter((mapping) => mapping.companyAccountId === companyAccountId)
      .flatMap((mapping) => {
        const candidate = evidenceCandidate(
          observation,
          mapping,
          catalog,
          this.compatibility,
          "historical_company_mapping",
          "strong",
          [
            `historical_confirmed_mapping:${mapping.source}`,
            `original_reference:${mapping.siiAccountId}`,
          ],
        );
        return candidate ? [candidate] : [];
      });
  }
}

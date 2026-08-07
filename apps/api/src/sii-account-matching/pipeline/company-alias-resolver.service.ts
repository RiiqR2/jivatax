import { Injectable } from "@nestjs/common";
import type {
  AccountObservation,
  CompanyAliasEvidence,
  PipelineCatalogAccount,
  SuggestionCandidate,
} from "./account-matching-pipeline.types";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";
import { evidenceCandidate } from "./resolver-support";

@Injectable()
export class CompanyAliasResolverService {
  constructor(
    private readonly compatibility = new AccountCompatibilityFilterService(),
  ) {}
  resolve(
    observation: AccountObservation,
    aliases: CompanyAliasEvidence[],
    catalog: PipelineCatalogAccount[],
  ): SuggestionCandidate[] {
    return aliases
      .filter(
        (alias) =>
          alias.active && alias.normalizedTerm === observation.normalizedName,
      )
      .flatMap((alias) => {
        const candidate = evidenceCandidate(
          observation,
          alias,
          catalog,
          this.compatibility,
          "company_alias",
          "strong",
          ["exact_active_company_alias"],
        );
        return candidate ? [candidate] : [];
      });
  }
}

import { Injectable } from "@nestjs/common";
import type {
  AccountObservation,
  PipelineCatalogAccount,
  SuggestionCandidate,
} from "./account-matching-pipeline.types";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import { pipelineFamilyDestination } from "./account-family-taxonomy";

@Injectable()
export class AccountingRuleResolverService {
  constructor(
    private readonly compatibility = new AccountCompatibilityFilterService(),
  ) {}

  resolve(
    observation: AccountObservation,
    catalog: PipelineCatalogAccount[],
  ): SuggestionCandidate[] {
    const destinationPattern = pipelineFamilyDestination(
      observation.accountFamily,
    );
    if (!destinationPattern) return [];
    return catalog.flatMap((account) => {
      const result = this.compatibility.evaluateCatalog(observation, account);
      if (
        !destinationPattern.test(normalizeAccountTerm(account.name)) ||
        !result.compatible
      )
        return [];
      return [
        {
          siiAccountId: account.id,
          siiCode: account.code,
          siiName: account.name,
          resolutionType: "accounting_rule" as const,
          recommendationLevel: "strong" as const,
          evidence: [`account_family:${observation.accountFamily}`],
          warnings: result.warnings,
          technicalScore: 1,
          technicalConfidence: 1,
        },
      ];
    });
  }
}

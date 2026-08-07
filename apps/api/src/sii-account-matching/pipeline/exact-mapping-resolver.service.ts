import { Injectable } from "@nestjs/common";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import type {
  AccountObservation,
  PipelineCatalogAccount,
  SuggestionCandidate,
} from "./account-matching-pipeline.types";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";

@Injectable()
export class ExactMappingResolverService {
  constructor(
    private readonly compatibility = new AccountCompatibilityFilterService(),
  ) {}

  resolve(
    observation: AccountObservation,
    catalog: PipelineCatalogAccount[],
  ): SuggestionCandidate[] {
    return catalog.flatMap((account) => {
      if (normalizeAccountTerm(account.name) !== observation.normalizedName)
        return [];
      const compatibility = this.compatibility.evaluateCatalog(
        observation,
        account,
      );
      if (!compatibility.compatible) return [];
      return [
        {
          siiAccountId: account.id,
          siiCode: account.code,
          siiName: account.name,
          resolutionType: "exact_official_name",
          recommendationLevel: "strong",
          evidence: ["exact_official_name"],
          warnings: compatibility.warnings,
          technicalScore: 1,
          technicalConfidence: 1,
          reviewRequired: true,
          resolvedSiiAccountId: account.id,
          referenceResolution: "direct",
        },
      ];
    });
  }
}

import { Injectable } from "@nestjs/common";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import type {
  AccountObservation,
  PipelineCatalogAccount,
  SuggestionCandidate,
} from "./account-matching-pipeline.types";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";

@Injectable()
export class CompatibleCandidateRankerService {
  constructor(
    private readonly compatibility = new AccountCompatibilityFilterService(),
  ) {}

  rank(
    observation: AccountObservation,
    catalog: PipelineCatalogAccount[],
  ): SuggestionCandidate[] {
    const observedTokens = new Set(
      observation.normalizedName.split(" ").filter((token) => token.length > 2),
    );
    return catalog
      .flatMap((account) => {
        const compatible = this.compatibility.evaluateCatalog(
          observation,
          account,
        );
        if (!compatible.compatible) return [];
        const destinationTokens = new Set(
          normalizeAccountTerm(account.name).split(" "),
        );
        const shared = [...observedTokens].filter((token) =>
          destinationTokens.has(token),
        ).length;
        const score =
          shared / Math.max(observedTokens.size, destinationTokens.size, 1);
        if (score === 0) return [];
        return [
          {
            siiAccountId: account.id,
            siiCode: account.code,
            siiName: account.name,
            resolutionType: "ranked" as const,
            recommendationLevel:
              score >= 0.75 ? ("probable" as const) : ("weak" as const),
            evidence: ["compatible_token_overlap"],
            warnings: compatible.warnings,
            technicalScore: score,
            technicalConfidence: score,
            reviewRequired: true,
            resolvedSiiAccountId: account.id,
            referenceResolution: "direct" as const,
          },
        ];
      })
      .sort((left, right) => right.technicalScore - left.technicalScore);
  }
}

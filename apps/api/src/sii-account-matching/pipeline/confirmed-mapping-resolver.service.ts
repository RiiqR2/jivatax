import { Injectable } from "@nestjs/common";
import type {
  ConfirmedMappingEvidence,
  PipelineCatalogAccount,
  SuggestionCandidate,
} from "./account-matching-pipeline.types";
import { resolveCatalogReference } from "./resolver-support";

@Injectable()
export class ConfirmedMappingResolverService {
  resolve(
    mapping: ConfirmedMappingEvidence | undefined,
    catalog: PipelineCatalogAccount[],
  ): SuggestionCandidate[] {
    if (!mapping) return [];
    const resolution = resolveCatalogReference(mapping, catalog);
    if (!resolution) return [];
    return [
      {
        siiAccountId: resolution.account.id,
        siiCode: resolution.account.code,
        siiName: resolution.account.name,
        resolutionType: "confirmed_mapping",
        recommendationLevel: "strong",
        evidence: [
          `confirmed_mapping_reused:${mapping.source}`,
          resolution.remapped
            ? "catalog_reference_remapped_by_stable_code"
            : "catalog_reference_direct",
        ],
        warnings: [],
        technicalScore: 1,
        technicalConfidence: 1,
        reviewRequired: false,
        reusedConfirmedMapping: true,
        originalSiiAccountId: resolution.remapped
          ? mapping.siiAccountId
          : undefined,
        resolvedSiiAccountId: resolution.account.id,
        referenceResolution: resolution.remapped ? "remapped" : "direct",
      },
    ];
  }
}

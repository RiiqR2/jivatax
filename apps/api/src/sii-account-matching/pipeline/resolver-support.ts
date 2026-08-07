import type {
  AccountObservation,
  PipelineCatalogAccount,
  SuggestionCandidate,
  ResolutionType,
  RecommendationLevel,
} from "./account-matching-pipeline.types";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";

export interface CatalogReference {
  siiAccountId: string;
  siiCode: string;
  siiName: string;
}

export function resolveCatalogReference(
  reference: CatalogReference,
  catalog: PipelineCatalogAccount[],
): { account: PipelineCatalogAccount; remapped: boolean } | undefined {
  const eligible = catalog.filter(
    (account) =>
      account.active !== false &&
      account.mappable !== false &&
      account.isLeaf !== false,
  );
  const direct = eligible.find(
    (account) => account.id === reference.siiAccountId,
  );
  if (direct) return { account: direct, remapped: false };
  const byStableCode = eligible.filter(
    (account) => account.code === reference.siiCode,
  );
  return byStableCode.length === 1
    ? { account: byStableCode[0], remapped: true }
    : undefined;
}

export function evidenceCandidate(
  observation: AccountObservation,
  reference: CatalogReference,
  catalog: PipelineCatalogAccount[],
  compatibility: AccountCompatibilityFilterService,
  resolutionType: ResolutionType,
  recommendationLevel: RecommendationLevel,
  evidence: string[],
  reusedConfirmedMapping = false,
): SuggestionCandidate | undefined {
  const resolution = resolveCatalogReference(reference, catalog);
  if (!resolution) return undefined;
  const compatible = compatibility.evaluateCatalog(
    observation,
    resolution.account,
  );
  if (!compatible.compatible) return undefined;
  return {
    siiAccountId: resolution.account.id,
    siiCode: resolution.account.code,
    siiName: resolution.account.name,
    resolutionType,
    recommendationLevel,
    evidence: [
      ...evidence,
      ...compatible.compatibilityEvidence,
      resolution.remapped
        ? "catalog_reference_remapped_by_stable_code"
        : "catalog_reference_direct",
    ],
    warnings: compatible.warnings,
    technicalScore: recommendationLevel === "strong" ? 1 : 0.8,
    technicalConfidence: recommendationLevel === "strong" ? 1 : 0.8,
    reviewRequired: !reusedConfirmedMapping,
    reusedConfirmedMapping: reusedConfirmedMapping || undefined,
    originalSiiAccountId: resolution.remapped
      ? reference.siiAccountId
      : undefined,
    resolvedSiiAccountId: resolution.account.id,
    referenceResolution: resolution.remapped ? "remapped" : "direct",
  };
}

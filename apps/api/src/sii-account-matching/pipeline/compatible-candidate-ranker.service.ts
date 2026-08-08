import { Injectable } from "@nestjs/common";
import {
  normalizeAccountTerm,
  weightedTokenSimilarity,
} from "../normalization/account-term-normalizer";
import type {
  AccountObservation,
  PipelineCatalogAccount,
  SuggestionCandidate,
} from "./account-matching-pipeline.types";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";
import { isTaxReconciliationChapter } from "../metadata/sii-catalog-hierarchy";

@Injectable()
export class CompatibleCandidateRankerService {
  constructor(
    private readonly compatibility = new AccountCompatibilityFilterService(),
  ) {}

  rank(
    observation: AccountObservation,
    catalog: PipelineCatalogAccount[],
  ): SuggestionCandidate[] {
    return catalog
      .flatMap((account) => {
        // The RLI tax-reconciliation schedule (~60% of the catalogue) is a
        // different domain from a Balance/P&L account; lexical overlap alone
        // must never resolve into it, only an exact name, curated term or
        // accounting rule may.
        if (isTaxReconciliationChapter(account.code)) return [];
        // A destination explicitly curated as residual/catch-all ("Otros ...")
        // is a last resort: only exact evidence should ever reach it.
        if (account.knowledge?.isResidual) return [];
        const compatible = this.compatibility.evaluateCatalog(
          observation,
          account,
        );
        if (!compatible.compatible) return [];
        // Lexical overlap orders candidates; it never establishes accounting
        // compatibility on its own.
        const structuralEvidence = compatible.compatibilityEvidence.filter(
          (item) => !item.startsWith("shared_specific_tokens:"),
        );
        if (structuralEvidence.length === 0) return [];
        // Reuses the same weighted, stopword-free similarity as the
        // productive ranking engine instead of a competing raw token count,
        // so generic words ("por", "cuenta", "otros"...) never manufacture a
        // false match on their own.
        const score = weightedTokenSimilarity(
          observation.normalizedName,
          normalizeAccountTerm(account.name),
        );
        if (score <= 0) return [];
        return [
          {
            siiAccountId: account.id,
            siiCode: account.code,
            siiName: account.name,
            resolutionType: "ranked" as const,
            recommendationLevel:
              structuralEvidence.length > 1 && score >= 0.75
                ? ("probable" as const)
                : ("weak" as const),
            evidence: ["compatible_token_overlap", ...structuralEvidence],
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

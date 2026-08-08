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
import {
  isOrderCatalogName,
  isResidualCatalogName,
  isTaxReconciliationChapter,
} from "../metadata/sii-catalog-hierarchy";

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
        // Residual catch-alls and memo/order accounts are last-resort
        // destinations: only exact evidence (earlier pipeline layers) may
        // reach them, never ranked token overlap.
        if (
          account.knowledge?.isResidual ||
          isResidualCatalogName(account.name) ||
          isOrderCatalogName(account.name)
        )
          return [];
        const compatible = this.compatibility.evaluateCatalog(
          observation,
          account,
        );
        if (!compatible.compatible) return [];
        // Section/nature alone are compatibility gates, not semantic proof.
        // Ranking requires shared specific tokens, a matched family or a
        // matched financial subfamily — otherwise prefer no_candidate.
        const semanticEvidence = compatible.compatibilityEvidence.filter(
          (item) =>
            item.startsWith("shared_specific_tokens:") ||
            item.startsWith("financial_subfamily:") ||
            item.startsWith("account_family:"),
        );
        if (semanticEvidence.length === 0) return [];
        // Token overlap without any accounting compatibility signal still
        // must not invent a candidate (e.g. two unrelated names that share
        // one rare word while both sections are unknown).
        const accountingEvidence = compatible.compatibilityEvidence.filter(
          (item) =>
            item.startsWith("statement_section:") ||
            item.startsWith("balance_nature:") ||
            item.startsWith("temporal_class:") ||
            item.startsWith("financial_subfamily:") ||
            item.startsWith("account_family:") ||
            item.startsWith("protected_tax_category:") ||
            item === "exact_normalized_name",
        );
        if (accountingEvidence.length === 0) return [];
        const structuralEvidence = compatible.compatibilityEvidence.filter(
          (item) => !item.startsWith("shared_specific_tokens:"),
        );
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
            evidence: [
              "compatible_token_overlap",
              ...semanticEvidence,
              ...structuralEvidence.filter(
                (item) => !semanticEvidence.includes(item),
              ),
            ],
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

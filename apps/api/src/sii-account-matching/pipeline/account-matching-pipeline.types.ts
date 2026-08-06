import type {
  AccountTerm,
  BalanceNature,
  ObservedAccountSection,
} from "../account-matching.types";
import type { PipelineAccountFamily } from "./account-family-taxonomy";

export type RelationshipClass = "related_party" | "third_party" | "unknown";
export type ContraAccountType =
  "asset_allowance" | "liability_allowance" | "none";
export type SpecialTaxCategory =
  | "rejected_expense"
  | "donation"
  | "undocumented_expense"
  | "tax_fine"
  | "foreign_income"
  | "deferred_tax"
  | "related_party"
  | "none";

/** Balance row consumed only by the isolated v2 matching pipeline. */
export interface AccountObservationInput {
  accountCode: string;
  accountName: string;
  assetAmount?: string | null;
  liabilityAmount?: string | null;
  lossAmount?: string | null;
  gainAmount?: string | null;
  debitBalance?: string | null;
  creditBalance?: string | null;
  debits?: string | null;
  credits?: string | null;
}

export interface AccountObservation {
  observedSection: ObservedAccountSection;
  balanceNature: BalanceNature | "unknown";
  accountFamily: PipelineAccountFamily;
  temporalClass?: AccountTerm;
  relationshipClass: RelationshipClass;
  contraAccountType: ContraAccountType;
  specialTaxCategory: SpecialTaxCategory;
  normalizedName: string;
  originalName: string;
  classificationEvidence: string[];
  classificationWarnings: string[];
}

export interface CompatibilityResult {
  compatible: boolean;
  exclusionReasons: string[];
  warnings: string[];
}

export type ResolutionType = "exact" | "accounting_rule" | "ranked";
export type RecommendationLevel = "strong" | "probable" | "weak";

export interface SuggestionCandidate {
  siiAccountId: string;
  siiCode: string;
  siiName: string;
  resolutionType: ResolutionType;
  recommendationLevel: RecommendationLevel;
  evidence: string[];
  warnings: string[];
  technicalScore: number;
  technicalConfidence: number;
}

export type SuggestionDecision =
  "strong" | "probable" | "weak" | "ambiguous" | "no_candidate";

export interface PipelineCatalogAccount {
  id: string;
  code: string;
  name: string;
}

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
  | "deferred_tax_asset"
  | "deferred_tax_liability"
  | "deferred_tax_unspecified"
  | "vat_credit"
  | "vat_debit"
  | "income_tax"
  | "tax_provision"
  | "tax_loss_carryforward"
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
  isLeaf?: boolean;
  active?: boolean;
  mappable?: boolean;
  parentCode?: string | null;
  level?: number;
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
  destinationMetadata?: Pick<
    AccountObservationInput,
    "isLeaf" | "active" | "mappable" | "parentCode" | "level"
  >;
}

export interface CompatibilityResult {
  compatible: boolean;
  exclusionReasons: string[];
  warnings: string[];
  compatibilityEvidence: string[];
  compatibilityLevel: "exact" | "compatible" | "uncertain" | "incompatible";
}

export type ResolutionType =
  | "confirmed_mapping"
  | "historical_company_mapping"
  | "company_alias"
  | "exact_official_name"
  | "exact_catalog_term"
  | "accounting_rule"
  | "ranked";
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
  reviewRequired: boolean;
  originalSiiAccountId?: string;
  resolvedSiiAccountId?: string;
  referenceResolution: "direct" | "remapped" | "unresolved";
  /** Informational only: v2 never writes or confirms a mapping. */
  reusedConfirmedMapping?: boolean;
}

export type SuggestionDecision =
  "strong" | "probable" | "weak" | "ambiguous" | "no_candidate";

export interface PipelineCatalogAccount {
  id: string;
  code: string;
  name: string;
  isLeaf?: boolean;
  active?: boolean;
  mappable?: boolean;
  parentCode?: string | null;
  level?: number;
}

export interface ConfirmedMappingEvidence {
  companyAccountId: string;
  siiAccountId: string;
  siiCode: string;
  siiName: string;
  confirmedAt?: Date | string;
  source: string;
}

export interface CompanyAliasEvidence {
  normalizedTerm: string;
  siiAccountId: string;
  siiCode: string;
  siiName: string;
  active: boolean;
}

export type CatalogTermType =
  | "official_name"
  | "company_alias"
  | "expert_alias"
  | "erp_term"
  | "industry_term"
  | "abbreviation"
  | "manual_term"
  | "negative_term";

export interface CatalogTermEvidence {
  normalizedTerm: string;
  type: CatalogTermType;
  scope: string;
  siiAccountId: string;
  siiCode: string;
  siiName: string;
  active: boolean;
  companyId?: string;
  industryId?: string;
}

export interface MatchingResolutionContext {
  companyId: string;
  /** Company industry carried by the productive adapter for scoped evidence. */
  industryId?: string;
  companyAccountId: string;
  accountObservation: AccountObservation | AccountObservationInput;
  confirmedMapping?: ConfirmedMappingEvidence;
  historicalCompanyMappings: ConfirmedMappingEvidence[];
  companyAliases: CompanyAliasEvidence[];
  catalogTerms: CatalogTermEvidence[];
  catalogAccounts: PipelineCatalogAccount[];
}

export interface MatchingResolutionResult {
  decision: SuggestionDecision;
  candidates: SuggestionCandidate[];
  resolutionStatus:
    "resolved" | "ambiguous" | "no_candidate" | "confirmed_mapping_unresolved";
  warnings: string[];
  unresolvedConfirmedMapping?: Pick<
    ConfirmedMappingEvidence,
    "siiAccountId" | "siiCode" | "siiName"
  >;
  /** v2 never creates a confirmation. */
  autoConfirmed: false;
}

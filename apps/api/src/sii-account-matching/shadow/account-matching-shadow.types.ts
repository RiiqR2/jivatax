import type { SuggestionDecision } from "../pipeline/account-matching-pipeline.types";

export interface ShadowV7Result {
  status:
    | "accepted"
    | "review"
    | "ambiguous"
    | "no_candidate"
    | "unavailable"
    | "confirmed_mapping";
  contextMatch: "verified" | "unverified" | "unavailable";
  winnerCode?: string;
  winnerName?: string;
  score?: number;
  confidence?: number;
  decision?: string;
}

export interface ShadowAccountComparison {
  companyAccountId: string;
  accountCode: string;
  accountName: string;
  observedSection: string;
  balanceNature: string;
  accountFamily: string;
  classificationWarnings: string[];
  v7: ShadowV7Result;
  v2: {
    resolutionStatus: string;
    decision: SuggestionDecision;
    resolutionType?: string;
    recommendationLevel?: string;
    winnerCode?: string;
    winnerName?: string;
    warnings: string[];
    evidence: string[];
    candidateCount: number;
  };
  comparison: {
    sameWinner: boolean;
    v7Only: boolean;
    v2Only: boolean;
    bothNoCandidate: boolean;
    differentWinner: boolean;
    confirmedMappingReused: boolean;
  };
}

export interface ShadowComparisonSummary {
  totalAccounts: number;
  sameWinner: number;
  differentWinner: number;
  v7Only: number;
  v2Only: number;
  bothNoCandidate: number;
  confirmedMappingsReused: number;
  v2Strong: number;
  v2Probable: number;
  v2Weak: number;
  v2Ambiguous: number;
  v2NoCandidate: number;
  v7ContextVerified: number;
  v7ContextUnverified: number;
  v7Unavailable: number;
  v7Review: number;
  v7Ambiguous: number;
  v7NoCandidate: number;
  comparableAccounts: number;
}

export interface AccountMatchingShadowReport {
  metadata: {
    companyId: string;
    taxPeriodId: string;
    balanceImportId: string;
    generatedAt: string;
    v2Version: "v2";
    v7Source: "persisted_diagnostics_and_suggestions";
    readOnly: true;
  };
  summary: ShadowComparisonSummary;
  accounts: ShadowAccountComparison[];
}

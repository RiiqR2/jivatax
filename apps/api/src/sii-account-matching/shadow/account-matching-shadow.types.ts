import type { SuggestionDecision } from "../pipeline/account-matching-pipeline.types";

export interface ShadowV7Result {
  available: boolean;
  winnerCode?: string;
  winnerName?: string;
  score?: number;
  confidence?: number;
  decision?: string;
  status?: string;
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
}

export interface AccountMatchingShadowReport {
  metadata: {
    companyId: string;
    taxPeriodId: string;
    balanceImportId: string;
    generatedAt: string;
    v2Version: "v2";
    v7Source: "persisted_account_matching_diagnostics";
    readOnly: true;
  };
  summary: ShadowComparisonSummary;
  accounts: ShadowAccountComparison[];
}

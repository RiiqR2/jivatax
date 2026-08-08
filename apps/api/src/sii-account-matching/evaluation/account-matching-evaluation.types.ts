import type {
  AccountObservation,
  RecommendationLevel,
  ResolutionType,
} from "../pipeline/account-matching-pipeline.types";

export type EvaluationCategory =
  | "strong_candidate"
  | "probable_candidate"
  | "weak_candidate"
  | "ambiguous"
  | "no_candidate"
  | "confirmed_mapping"
  | "blocked_confirmed_mapping"
  | "contradictory_source"
  | "protected_tax_case"
  | "structural_mismatch"
  | "needs_manual_review";

export type EvaluationReasonSeverity = "critical" | "warning" | "informational";

export interface EvaluationReason {
  reason: string;
  severity: EvaluationReasonSeverity;
}

export interface EvaluationCandidate {
  siiCode: string;
  siiName: string;
  recommendationLevel: RecommendationLevel;
  evidence: string[];
  warnings: string[];
  exclusionReason?: string;
}

export interface EvaluationAccount extends AccountObservation {
  companyAccountId: string;
  accountCode: string;
  accountName: string;
  evaluationCategory: EvaluationCategory;
  criticalCases: string[];
  reasons: string[];
  reasonDetails: EvaluationReason[];
  basicAccount: boolean;
  basicAccountWithoutCandidate: boolean;
  winner?: EvaluationCandidate & { resolutionType: ResolutionType };
  alternatives: EvaluationCandidate[];
}

export interface EvaluationReport {
  metadata: {
    companyId: string;
    taxPeriodId: string;
    balanceImportId: string;
    generatedAt: string;
    version: "v2";
    readOnly: true;
  };
  summary: Record<string, number | Record<string, number>>;
  alerts: Record<string, number>;
  topIssues: Array<{
    accountCode: string;
    accountName: string;
    issueType: string;
    explanation: string;
    winnerCode?: string;
    winnerName?: string;
    evidence: string[];
    warnings: string[];
  }>;
  accounts: EvaluationAccount[];
}

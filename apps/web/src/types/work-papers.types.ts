export type WorkPaperExecutionStatus = "draft" | "finalized";

export interface RelatedWorkPaperAccount {
  roleKey: string;
  rationale: string | null;
  companyAccountId: string;
  companyAccountCode: string;
  companyAccountName: string;
  siiAccountId: string;
  siiAccountCode: string;
  siiAccountName: string;
}

export interface WorkPaperExecutionSummary {
  id: string;
  status: WorkPaperExecutionStatus;
  revision: number;
  supersedesExecutionId: string | null;
  finalizedAt: string | null;
}

export interface ApplicableWorkPaper {
  definitionId: string;
  code: string;
  name: string;
  definitionVersion: number;
  calculatorKey: string | null;
  documentationStatus: string | null;
  reason: string;
  relatedAccounts: RelatedWorkPaperAccount[];
  executions: WorkPaperExecutionSummary[];
}

export interface WorkPaperDefinitionSummary {
  id: string;
  code: string;
  name: string;
  version: number;
}

export interface WorkPaperInput {
  id: string;
  inputKey: string;
  sourceType: string;
  sourceEntityType: string | null;
  valueSnapshot: string | null;
  payloadSnapshot: Record<string, unknown> | null;
  revision: number;
  status: string;
}

export interface WorkPaperReconciliation {
  key: string;
  calculatedAmount: string;
  reportedAmount: string;
  difference: string;
  tolerance?: string;
  status: "ok" | "warning" | "error" | string;
  messages: string[];
}

export interface TaxAdjustment {
  id: string;
  type: string;
  amount: string;
  description: string;
  differenceNature: string | null;
  ruleKey: string;
  revision: number;
  status: string;
}

export interface WorkPaperEvidence {
  id: string;
  evidenceType: string;
  sourceEntityType: string;
  locator: Record<string, unknown> | null;
  description: string | null;
}

export interface WorkPaperResultSnapshot {
  missingInputs: string[];
  warnings: string[];
  reconciliations: WorkPaperReconciliation[];
  calculatedValues: Record<string, string | number | boolean | null>;
}

export interface WorkPaperExecutionDetail {
  id: string;
  definitionId: string;
  status: WorkPaperExecutionStatus;
  revision: number;
  supersedesExecutionId: string | null;
  finalizedAt: string | null;
  resultSnapshot: WorkPaperResultSnapshot | Record<string, unknown> | null;
  definition: WorkPaperDefinitionSummary;
  inputs: WorkPaperInput[];
  evidence: WorkPaperEvidence[];
  historicalEvidence: WorkPaperEvidence[];
  adjustments: TaxAdjustment[];
}

export interface A17ManualInput {
  inputKey: string;
  value: string;
  description?: string;
}

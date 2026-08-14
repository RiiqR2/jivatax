import { WorkPaperExecutionStatus } from "./tax-work-paper.enums";

export interface ApplicableRawRow {
  definitionId: string;
  code: string;
  name: string;
  definitionVersion: number;
  definitionMetadata: unknown;
  roleKey: string;
  rationale: string | null;
  companyAccountId: string;
  companyAccountCode: string;
  companyAccountName: string;
  siiAccountId: string;
  siiAccountCode: string;
  siiAccountName: string;
  executionId: string | null;
  executionStatus: WorkPaperExecutionStatus | null;
  executionRevision: number | null;
  supersedesExecutionId: string | null;
  finalizedAt: Date | string | null;
}

export interface ApplicableRelatedAccount {
  roleKey: string;
  rationale: string | null;
  companyAccountId: string;
  companyAccountCode: string;
  companyAccountName: string;
  siiAccountId: string;
  siiAccountCode: string;
  siiAccountName: string;
}

export interface ApplicableExecutionSummary {
  id: string;
  status: WorkPaperExecutionStatus;
  revision: number;
  supersedesExecutionId: string | null;
  finalizedAt: Date | string | null;
}

export interface ApplicableResult {
  definitionId: string;
  code: string;
  name: string;
  definitionVersion: number;
  calculatorKey: string | null;
  documentationStatus: string | null;
  reason: "confirmed_sii_account_mapping";
  relatedAccounts: ApplicableRelatedAccount[];
  executions: ApplicableExecutionSummary[];
}

export function definitionMetadataFields(raw: unknown): {
  calculatorKey: string | null;
  documentationStatus: string | null;
} {
  const metadata =
    typeof raw === "string"
      ? (JSON.parse(raw) as Record<string, unknown>)
      : raw && typeof raw === "object"
        ? (raw as Record<string, unknown>)
        : null;
  const calculatorKey =
    typeof metadata?.calculatorKey === "string" ? metadata.calculatorKey : null;
  const documentationStatus =
    typeof metadata?.documentationStatus === "string"
      ? metadata.documentationStatus
      : null;
  return { calculatorKey, documentationStatus };
}

function relatedAccountKey(row: ApplicableRawRow): string {
  return `${row.companyAccountId}\u0000${row.siiAccountCode}\u0000${row.roleKey}`;
}

export function groupApplicableRows(
  rows: readonly ApplicableRawRow[],
): ApplicableResult[] {
  const grouped = new Map<
    string,
    ApplicableResult & { accountKeys: Set<string> }
  >();
  for (const row of rows) {
    const item = grouped.get(row.definitionId) ?? {
      definitionId: row.definitionId,
      code: row.code,
      name: row.name,
      definitionVersion: row.definitionVersion,
      ...definitionMetadataFields(row.definitionMetadata),
      reason: "confirmed_sii_account_mapping" as const,
      relatedAccounts: [],
      executions: [],
      accountKeys: new Set<string>(),
    };
    const accountKey = relatedAccountKey(row);
    if (!item.accountKeys.has(accountKey)) {
      item.accountKeys.add(accountKey);
      item.relatedAccounts.push({
        roleKey: row.roleKey,
        rationale: row.rationale,
        companyAccountId: row.companyAccountId,
        companyAccountCode: row.companyAccountCode,
        companyAccountName: row.companyAccountName,
        siiAccountId: row.siiAccountId,
        siiAccountCode: row.siiAccountCode,
        siiAccountName: row.siiAccountName,
      });
    }
    if (
      row.executionId &&
      !item.executions.some((execution) => execution.id === row.executionId)
    )
      item.executions.push({
        id: row.executionId,
        status: row.executionStatus!,
        revision: row.executionRevision!,
        supersedesExecutionId: row.supersedesExecutionId,
        finalizedAt: row.finalizedAt,
      });
    grouped.set(row.definitionId, item);
  }
  return [...grouped.values()].map((item) => ({
    definitionId: item.definitionId,
    code: item.code,
    name: item.name,
    definitionVersion: item.definitionVersion,
    calculatorKey: item.calculatorKey,
    documentationStatus: item.documentationStatus,
    reason: item.reason,
    relatedAccounts: item.relatedAccounts,
    executions: item.executions,
  }));
}

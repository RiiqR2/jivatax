import type {
  ApplicableWorkPaper,
  WorkPaperExecutionDetail,
  WorkPaperExecutionStatus,
  WorkPaperExecutionSummary,
  WorkPaperJobStatus,
  WorkPaperPeriodSummaryRow,
  WorkPaperReconciliation,
  WorkPaperResultSnapshot,
} from "@/types/work-papers.types";

export const EMPTY_APPLICABLE_MESSAGE =
  "No se detectaron papeles de trabajo para las homologaciones confirmadas de este período.";

export const CALCULATOR_NOT_IMPLEMENTED = "Cálculo aún no implementado";
export const PROFESSIONAL_REVIEW_LABEL = "Requiere revisión profesional";

export const A17_MANUAL_FIELDS: ReadonlyArray<{
  inputKey: string;
  label: string;
  description: string;
}> = [
  {
    inputKey: "LEASE_LIABILITY_OPENING",
    label: "Apertura de obligación",
    description: "LEASE_LIABILITY_OPENING",
  },
  {
    inputKey: "LEASE_LIABILITY_CLOSING",
    label: "Cierre de obligación",
    description: "LEASE_LIABILITY_CLOSING",
  },
  {
    inputKey: "DEFERRED_INTEREST_OPENING",
    label: "Apertura de interés diferido",
    description: "DEFERRED_INTEREST_OPENING",
  },
  {
    inputKey: "DEFERRED_INTEREST_CLOSING",
    label: "Cierre de interés diferido",
    description: "DEFERRED_INTEREST_CLOSING",
  },
  {
    inputKey: "NEW_LEASE_CONTRACTS",
    label: "Contratos nuevos",
    description: "NEW_LEASE_CONTRACTS",
  },
  {
    inputKey: "LEASE_PAYMENTS",
    label: "Pagos / cuotas",
    description: "LEASE_PAYMENTS",
  },
  {
    inputKey: "LEASE_MONETARY_CORRECTION",
    label: "Corrección monetaria de obligación",
    description: "LEASE_MONETARY_CORRECTION",
  },
  {
    inputKey: "LEASE_REMEASUREMENTS",
    label: "Remediciones de obligación",
    description: "LEASE_REMEASUREMENTS",
  },
  {
    inputKey: "OTHER_LEASE_MOVEMENTS",
    label: "Otros movimientos de obligación",
    description: "OTHER_LEASE_MOVEMENTS",
  },
  {
    inputKey: "NEW_DEFERRED_INTEREST",
    label: "Nuevo interés diferido",
    description: "NEW_DEFERRED_INTEREST",
  },
  {
    inputKey: "DEFERRED_INTEREST_MONETARY_CORRECTION",
    label: "Corrección monetaria de interés diferido",
    description: "DEFERRED_INTEREST_MONETARY_CORRECTION",
  },
  {
    inputKey: "DEFERRED_INTEREST_REMEASUREMENTS",
    label: "Remediciones de interés diferido",
    description: "DEFERRED_INTEREST_REMEASUREMENTS",
  },
  {
    inputKey: "OTHER_DEFERRED_INTEREST_MOVEMENTS",
    label: "Otros movimientos de interés diferido",
    description: "OTHER_DEFERRED_INTEREST_MOVEMENTS",
  },
  {
    inputKey: "DEFERRED_INTEREST_AMORTIZATION",
    label: "Amortización de interés diferido",
    description: "DEFERRED_INTEREST_AMORTIZATION",
  },
];

const DECIMAL_VALUE = /^-?\d+(\.\d{1,4})?$/;

export function latestExecution(
  executions: WorkPaperExecutionSummary[],
): WorkPaperExecutionSummary | null {
  if (executions.length === 0) return null;
  return [...executions].sort(
    (left, right) => right.revision - left.revision,
  )[0];
}

export function listPresentationStatus(
  executions: WorkPaperExecutionSummary[],
): {
  label: string;
  variant: "neutral" | "warning" | "success";
  latest: WorkPaperExecutionSummary | null;
} {
  const latest = latestExecution(executions);
  if (!latest) {
    return { label: "Sin iniciar", variant: "neutral", latest: null };
  }
  if (latest.status === "finalized") {
    return { label: "Finalizado", variant: "success", latest };
  }
  return { label: "Borrador", variant: "warning", latest };
}

export function hasExecutionHistory(
  executions: WorkPaperExecutionSummary[],
): boolean {
  return executions.length > 1;
}

export function canCalculateA17(options: {
  definitionCode: string;
  status: WorkPaperExecutionStatus;
}): boolean {
  return options.definitionCode === "A.17" && options.status === "draft";
}

export function workPapersPath(companyId: string, taxPeriodId: string): string {
  return `/companies/${companyId}/periods/${taxPeriodId}/work-papers`;
}

export function workPaperExecutionPath(
  companyId: string,
  taxPeriodId: string,
  executionId: string,
): string {
  return `${workPapersPath(companyId, taxPeriodId)}/executions/${executionId}`;
}

export function isAutomaticInput(sourceType: string): boolean {
  return sourceType === "balance" || sourceType === "general_ledger";
}

export function inputSourceLabel(sourceType: string): string {
  if (sourceType === "manual") return "Manual";
  if (isAutomaticInput(sourceType)) return "Automático";
  return sourceType;
}

export function parseResultSnapshot(
  raw: WorkPaperExecutionDetail["resultSnapshot"],
): WorkPaperResultSnapshot {
  const snapshot =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const missingInputs = Array.isArray(snapshot.missingInputs)
    ? snapshot.missingInputs.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const warnings = Array.isArray(snapshot.warnings)
    ? snapshot.warnings.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
  const reconciliations = Array.isArray(snapshot.reconciliations)
    ? snapshot.reconciliations.filter(isReconciliation)
    : [];
  const calculatedValues =
    snapshot.calculatedValues && typeof snapshot.calculatedValues === "object"
      ? (snapshot.calculatedValues as Record<
          string,
          string | number | boolean | null
        >)
      : {};
  return { missingInputs, warnings, reconciliations, calculatedValues };
}

function isReconciliation(value: unknown): value is WorkPaperReconciliation {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.key === "string" &&
    typeof item.calculatedAmount === "string" &&
    typeof item.reportedAmount === "string" &&
    typeof item.difference === "string" &&
    typeof item.status === "string" &&
    Array.isArray(item.messages)
  );
}

export function requiresProfessionalReview(
  snapshot: WorkPaperResultSnapshot,
): boolean {
  return snapshot.calculatedValues.requiresProfessionalReview === true;
}

export function reconciliationVariant(
  status: string,
): "success" | "warning" | "error" {
  if (status === "ok") return "success";
  if (status === "error") return "error";
  return "warning";
}

export function isValidA17Decimal(value: string): boolean {
  return DECIMAL_VALUE.test(value);
}

export function isCalculatorImplemented(definitionCode: string): boolean {
  return definitionCode === "A.17";
}

export function hasCalculatedMetrics(
  row: WorkPaperPeriodSummaryRow,
  definitionCode: string,
): boolean {
  if (!isCalculatorImplemented(definitionCode)) return false;
  if (row.executionStatus === "not_started") return false;
  if (row.latestJobStatus === "completed") return true;
  if (row.executionStatus === "finalized") return true;
  return false;
}

export function formatMetricCount(count: number, showValues: boolean): string {
  return showValues ? String(count) : "—";
}

export function formatAdjustmentsCell(
  row: WorkPaperPeriodSummaryRow,
  showValues: boolean,
): string {
  if (!showValues) return "—";
  if (row.proposedAdjustmentsCount === 0) return "0";
  if (row.proposedAdjustmentsTotal) {
    return `${row.proposedAdjustmentsCount} · ${row.proposedAdjustmentsTotal}`;
  }
  return String(row.proposedAdjustmentsCount);
}

export function formatProfessionalReviewCell(
  requiresReview: boolean,
  showValues: boolean,
): string {
  if (!showValues) return "—";
  return requiresReview ? PROFESSIONAL_REVIEW_LABEL : "—";
}

export function operationalPresentationStatus(row: WorkPaperPeriodSummaryRow): {
  label: string;
  variant: "neutral" | "info" | "warning" | "success" | "error";
  secondary: string | null;
} {
  if (isJobInProgress(row.latestJobStatus)) {
    return { label: "Procesando", variant: "info", secondary: null };
  }
  if (row.latestJobStatus === "failed") {
    return { label: "Error", variant: "error", secondary: null };
  }
  if (row.executionStatus === "not_started") {
    return {
      label: "Sin iniciar",
      variant: "neutral",
      secondary: isCalculatorImplemented(row.code)
        ? null
        : CALCULATOR_NOT_IMPLEMENTED,
    };
  }
  if (row.executionStatus === "finalized") {
    return { label: "Finalizado", variant: "success", secondary: null };
  }
  return {
    label: "Borrador",
    variant: "warning",
    secondary: isCalculatorImplemented(row.code)
      ? null
      : CALCULATOR_NOT_IMPLEMENTED,
  };
}

export function relatedAccountsForExecution(
  papers: ApplicableWorkPaper[] | undefined,
  definitionId: string,
): ApplicableWorkPaper["relatedAccounts"] {
  return (
    papers?.find((paper) => paper.definitionId === definitionId)
      ?.relatedAccounts ?? []
  );
}

export function relatedAccountsForDefinition(
  papers: ApplicableWorkPaper[] | undefined,
  definitionId: string,
): ApplicableWorkPaper["relatedAccounts"] {
  return relatedAccountsForExecution(papers, definitionId);
}

export function isJobInProgress(
  status: WorkPaperJobStatus | null | undefined,
): boolean {
  return status === "pending" || status === "running";
}

export function jobStatusLabel(status: WorkPaperJobStatus): string {
  if (status === "pending") return "Pendiente";
  if (status === "running") return "Procesando";
  if (status === "completed") return "Completado";
  return "Error";
}

export function jobStatusVariant(
  status: WorkPaperJobStatus,
): "neutral" | "info" | "success" | "error" {
  if (status === "pending") return "neutral";
  if (status === "running") return "info";
  if (status === "completed") return "success";
  return "error";
}

export function executionStatusLabel(
  status: WorkPaperPeriodSummaryRow["executionStatus"],
): string {
  if (status === "not_started") return "Sin iniciar";
  if (status === "draft") return "Borrador";
  return "Finalizado";
}

export function executionStatusVariant(
  status: WorkPaperPeriodSummaryRow["executionStatus"],
): "neutral" | "warning" | "success" {
  if (status === "finalized") return "success";
  if (status === "draft") return "warning";
  return "neutral";
}

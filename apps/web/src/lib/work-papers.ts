import type {
  ApplicableWorkPaper,
  WorkPaperExecutionDetail,
  WorkPaperExecutionStatus,
  WorkPaperExecutionSummary,
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

export function relatedAccountsForExecution(
  papers: ApplicableWorkPaper[] | undefined,
  definitionId: string,
): ApplicableWorkPaper["relatedAccounts"] {
  return (
    papers?.find((paper) => paper.definitionId === definitionId)
      ?.relatedAccounts ?? []
  );
}

export function formatRationale(rationale: string | null): string | null {
  if (!rationale) return null;
  const match = rationale.match(/sourceRows=([\d,]+)/);
  if (match) return `Fila fuente ${match[1]}`;
  return rationale;
}

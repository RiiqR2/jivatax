import type {
  TaxDocumentReport,
  ValidationIssue,
} from "@/types/accounting.types";

export const documentStatus = {
  uploaded: { label: "Cargado", variant: "info" },
  validating: { label: "Validando", variant: "info" },
  valid: { label: "Validado", variant: "success" },
  invalid: { label: "Inválido", variant: "danger" },
  processing: { label: "Procesando", variant: "info" },
  processed: { label: "Procesado", variant: "success" },
  superseded: { label: "Reemplazado", variant: "neutral" },
  processing_error: { label: "Error de procesamiento", variant: "danger" },
} as const;

export function statusPresentation(status: string) {
  return (
    documentStatus[status as keyof typeof documentStatus] ?? {
      label: status,
      variant: "neutral",
    }
  );
}

const fields: Record<string, string> = {
  debitBalance: "Saldo deudor",
  creditBalance: "Saldo acreedor",
  assets: "Activo",
  liabilities: "Pasivo",
  losses: "Pérdidas",
  gains: "Ganancias",
  debits: "Débitos",
  credits: "Créditos",
  debit: "Debe",
  credit: "Haber",
  accountCode: "Código cuenta",
  accountName: "Nombre cuenta",
  totals: "Totales",
};

export const fieldLabel = (field: string) => fields[field] ?? field;

export function displayRawValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Vacío";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function groupIssues(issues: ValidationIssue[]) {
  const grouped = new Map<
    string,
    { code: string; message: string; fields: Map<string, number> }
  >();
  for (const issue of issues) {
    const current = grouped.get(issue.code) ?? {
      code: issue.code,
      message: issue.message,
      fields: new Map<string, number>(),
    };
    current.fields.set(issue.field, (current.fields.get(issue.field) ?? 0) + 1);
    grouped.set(issue.code, current);
  }
  return [...grouped.values()].map((group) => ({
    code: group.code,
    message: group.message,
    fields: [...group.fields].map(([field, count]) => ({ field, count })),
  }));
}

export function canReviewMappings(
  documentType: string,
  status: string,
  report: TaxDocumentReport | null | undefined,
  hasAccounts = true,
) {
  return (
    documentType === "balance" &&
    status === "processed" &&
    (report?.validRows ?? 0) > 0 &&
    hasAccounts
  );
}

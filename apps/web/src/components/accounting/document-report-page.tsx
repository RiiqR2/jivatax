"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  displayRawValue,
  fieldLabel,
  groupIssues,
  statusPresentation,
} from "@/lib/accounting-presentation";
import { accountingService } from "@/services/accounting.service";
import type { ValidationIssue } from "@/types/accounting.types";

export function DocumentReportPage({
  companyId,
  taxPeriodId,
  documentId,
}: {
  companyId: string;
  taxPeriodId: string;
  documentId: string;
}) {
  const documentQuery = useQuery({
    queryKey: ["tax-document", companyId, taxPeriodId, documentId],
    queryFn: () =>
      accountingService.document(companyId, taxPeriodId, documentId),
  });
  const reportQuery = useQuery({
    queryKey: ["tax-document-report", companyId, taxPeriodId, documentId],
    queryFn: () =>
      accountingService.getTaxDocumentReport(
        companyId,
        taxPeriodId,
        documentId,
      ),
  });
  const [kind, setKind] = useState<"all" | "errors" | "warnings">("all");
  const [search, setSearch] = useState("");
  const [field, setField] = useState("");
  const [code, setCode] = useState("");
  const [row, setRow] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const document = documentQuery.data;
  const report = reportQuery.data;
  const issues = useMemo(() => {
    const errors = (report?.errors ?? []).map((issue) => ({
      ...issue,
      kind: "error" as const,
    }));
    const warnings = (report?.warnings ?? []).map((issue) => ({
      ...issue,
      kind: "warning" as const,
    }));
    return [
      ...(kind === "warnings" ? [] : errors),
      ...(kind === "errors" ? [] : warnings),
    ].filter(
      (issue) =>
        (!search ||
          `${issue.message} ${displayRawValue(issue.rawValue)}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (!field || issue.field === field) &&
        (!code || issue.code === code) &&
        (!row || String(issue.sourceRowNumber) === row),
    );
  }, [report, kind, search, field, code, row]);
  const paged = issues.slice((page - 1) * pageSize, page * pageSize);
  if (documentQuery.isLoading || reportQuery.isLoading)
    return <main className="p-8">Cargando reporte…</main>;
  if (!document || !report)
    return (
      <main className="p-8" role="alert">
        No fue posible cargar el reporte.
      </main>
    );
  const status = statusPresentation(document.status);
  const download = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `reporte-${document.documentType}-v${document.versionNumber}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const totalPages = Math.max(1, Math.ceil(issues.length / pageSize));
  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/companies/${companyId}/periods/${taxPeriodId}/documents/${documentId}`}
            className="text-sm text-emerald-700"
          >
            ← Volver al documento
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">Reporte de validación</h1>
          <p className="mt-1 text-slate-600">
            {document.storedFile.originalName} · v{document.versionNumber} ·{" "}
            {document.documentType} · {status.label}
          </p>
        </div>
        <button
          type="button"
          onClick={download}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Descargar reporte JSON
        </button>
      </header>
      <section
        aria-labelledby="report-summary"
        className="mt-6 rounded-xl border bg-white p-5"
      >
        <h2 id="report-summary" className="font-semibold">
          Resumen
        </h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-4">
          <Metric label="Filas leídas" value={report.rowsRead} />
          <Metric label="Filas válidas" value={report.validRows} />
          <Metric label="Filas ignoradas" value={report.ignoredRows} />
          <Metric label="Errores" value={report.errors?.length ?? 0} />
          <Metric label="Warnings" value={report.warnings?.length ?? 0} />
          <Metric label="Hoja detectada" value={report.detectedSheet} />
          <Metric label="Fila de encabezado" value={report.headerRowNumber} />
        </dl>
      </section>
      {(report.systemTotals || report.reportedTotals) && (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <TotalsSection
            title="Totales informados por la empresa"
            description="Valores declarados por la contabilidad; los vacíos permanecen vacíos."
            totals={report.reportedTotals ?? {}}
          />
          <TotalsSection
            title="Totales recalculados por JivaTax"
            description="Valores interpretados y sumados exclusivamente desde filas de cuentas."
            totals={report.systemTotals ?? {}}
          />
        </div>
      )}
      {report.totalDifferences && (
        <section className="mt-5 rounded-xl border bg-white p-5">
          <TotalsSection
            title="Diferencia"
            description="Diferencia entre los totales informados y el detalle recalculado."
            totals={report.totalDifferences}
          />
          <p className="mt-3 text-sm font-medium text-slate-700">
            {report.accountingChecks?.reportedTotalMatchesCalculated
              ? "Los totales informados coinciden con el detalle recalculado."
              : "Se detectaron diferencias entre los totales informados y el detalle de cuentas. JivaTax no modificará los valores entregados por la empresa."}
          </p>
        </section>
      )}
      {(report.comparisons?.length ?? 0) > 0 && (
        <section className="mt-5 rounded-xl border bg-white p-5">
          <h2 className="font-semibold">
            Comparación informado versus calculado
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Concepto",
                    "Informado",
                    "Calculado",
                    "Diferencia",
                    "Estado",
                  ].map((label) => (
                    <th key={label} className="px-3 py-2" scope="col">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.comparisons?.map((comparison) => (
                  <tr key={comparison.field} className="border-t">
                    <td className="px-3 py-2">
                      {fieldLabel(comparison.field)}
                    </td>
                    <td className="px-3 py-2">
                      {comparison.reported === null
                        ? "Vacío en archivo"
                        : comparison.reported}
                    </td>
                    <td className="px-3 py-2">{comparison.calculated}</td>
                    <td className="px-3 py-2">
                      {comparison.difference ?? "No comparable"}
                    </td>
                    <td className="px-3 py-2">
                      {comparison.status === "matched"
                        ? "Consistente"
                        : comparison.status === "mismatched"
                          ? "Con diferencia"
                          : "No informado"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {(report.totals ||
        Object.keys(report.reconciliation ?? {}).length > 0) && (
        <section className="mt-5 rounded-xl border bg-white p-5">
          <h2 className="font-semibold">Conciliación y totales</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            {/* {Object.entries(report.totals ?? {}).map(([key, value]) => (
              <Metric key={key} label={fieldLabel(key)} value={String(value)} />
            ))} */}
            {report.reconciliation?.movements && (
              <>
                <Metric
                  label="Debe"
                  value={formatAmount(
                    report.reconciliation.movements.debitTotal,
                  )}
                />
                <Metric
                  label="Haber"
                  value={formatAmount(
                    report.reconciliation.movements.creditTotal,
                  )}
                />
                <Metric
                  label="Diferencia movimientos"
                  value={formatAmount(
                    report.reconciliation.movements.difference,
                  )}
                />
                <Metric
                  label="Estado movimientos"
                  value={
                    report.reconciliation.movements.isBalanced
                      ? "Cuadrado"
                      : "Descuadrado"
                  }
                />
              </>
            )}
            {report.reconciliation?.equity && (
              <>
                <Metric
                  label="Activo + Pérdidas"
                  value={formatAmount(report.reconciliation.equity.leftSide)}
                />
                <Metric
                  label="Pasivo + Ganancias"
                  value={formatAmount(report.reconciliation.equity.rightSide)}
                />
                <Metric
                  label="Diferencia patrimonial"
                  value={formatAmount(report.reconciliation.equity.difference)}
                />
                <Metric
                  label="Estado patrimonial"
                  value={
                    report.reconciliation.equity.isBalanced
                      ? "Cuadrado"
                      : "Descuadrado"
                  }
                />
              </>
            )}
          </dl>
        </section>
      )}
      <section
        className="mt-5 rounded-xl border bg-white p-5"
        aria-labelledby="grouped-errors"
      >
        <h2 id="grouped-errors" className="font-semibold">
          Errores agrupados
        </h2>
        {groupIssues(report.errors ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No hay errores de validación.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {groupIssues(report.errors ?? []).map((group) => (
              <article
                key={group.code}
                className="rounded-lg border border-red-200 bg-red-50 p-4"
              >
                <h3 className="font-medium">{group.message}</h3>
                <p className="text-xs text-red-700">{group.code}</p>
                <ul className="mt-2 text-sm">
                  {group.fields.map((item) => (
                    <li key={item.field}>
                      {fieldLabel(item.field)}: <strong>{item.count}</strong>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
      <section
        className="mt-5 rounded-xl border bg-white p-5"
        aria-labelledby="issue-detail"
      >
        <h2 id="issue-detail" className="font-semibold">
          Detalle de hallazgos
        </h2>
        <div
          className="mt-4 flex flex-wrap gap-2"
          role="group"
          aria-label="Tipo de hallazgo"
        >
          {(["all", "errors", "warnings"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setKind(value);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-2 text-sm ${kind === value ? "bg-slate-900 text-white" : "border"}`}
            >
              {value === "all"
                ? "Todos"
                : value === "errors"
                  ? "Errores"
                  : "Warnings"}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="text-sm">
            Buscar
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
          <Filter
            label="Código"
            value={code}
            setValue={setCode}
            values={[
              ...new Set(
                [...(report.errors ?? []), ...(report.warnings ?? [])].map(
                  (issue) => issue.code,
                ),
              ),
            ]}
          />
          <Filter
            label="Campo"
            value={field}
            setValue={setField}
            values={[
              ...new Set(
                [...(report.errors ?? []), ...(report.warnings ?? [])].map(
                  (issue) => issue.field,
                ),
              ),
            ]}
            fieldLabels
          />
          <label className="text-sm">
            Número de fila
            <input
              type="number"
              value={row}
              onChange={(event) => setRow(event.target.value)}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Errores y advertencias del reporte de importación
            </caption>
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Tipo",
                  "Fila",
                  "Campo",
                  "Código",
                  "Mensaje",
                  "Valor recibido",
                ].map((label) => (
                  <th key={label} scope="col" className="px-3 py-2">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((issue, index) => (
                <IssueRow
                  key={`${issue.kind}-${issue.code}-${issue.sourceRowNumber}-${index}`}
                  issue={issue}
                />
              ))}
            </tbody>
          </table>
        </div>
        {issues.length === 0 && (
          <p className="py-5 text-center text-sm text-slate-600">
            No hay hallazgos para estos filtros.
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm">
            Filas por página{" "}
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded border p-1"
            >
              {[25, 50, 100].map((size) => (
                <option key={size}>{size}</option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm">
              Página {page} de {totalPages}
            </span>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded border px-3 py-1 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-semibold">
        {value === null || value === undefined ? "—" : String(value)}
      </dd>
    </div>
  );
}

function formatAmount(value: number | string): string {
  const text = String(value);
  const negative = text.startsWith("-");
  const [integer, fraction = ""] = (negative ? text.slice(1) : text).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimals = fraction.replace(/0+$/, "");
  return `${negative ? "-" : ""}${grouped}${decimals ? `,${decimals}` : ""}`;
}

function TotalsSection({
  title,
  description,
  totals,
}: {
  title: string;
  description: string;
  totals: Record<string, string | null>;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <dl className="mt-4 grid grid-cols-2 gap-4">
        {Object.entries(totals).map(([field, value]) => (
          <Metric
            key={field}
            label={fieldLabel(field)}
            value={value === null ? "Vacío en archivo" : formatAmount(value)}
          />
        ))}
      </dl>
    </div>
  );
}
function Filter({
  label,
  value,
  setValue,
  values,
  fieldLabels = false,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  values: string[];
  fieldLabels?: boolean;
}) {
  return (
    <label className="text-sm">
      {label}
      <select
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-1 w-full rounded-lg border p-2"
      >
        <option value="">Todos</option>
        {values.map((item) => (
          <option key={item} value={item}>
            {fieldLabels ? fieldLabel(item) : item}
          </option>
        ))}
      </select>
    </label>
  );
}
function IssueRow({
  issue,
}: {
  issue: ValidationIssue & { kind: "error" | "warning" };
}) {
  const raw = displayRawValue(issue.rawValue);
  return (
    <tr
      className={`border-t ${issue.kind === "warning" ? "bg-amber-50" : "bg-red-50/40"}`}
    >
      <td className="px-3 py-2">
        <span className="font-medium">
          {issue.kind === "error" ? "Error" : "Warning"}
        </span>
      </td>
      <td className="px-3 py-2">{issue.sourceRowNumber || "General"}</td>
      <td className="px-3 py-2">{fieldLabel(issue.field)}</td>
      <td className="px-3 py-2 font-mono text-xs">{issue.code}</td>
      <td className="px-3 py-2">{issue.message}</td>
      <td className="max-w-64 px-3 py-2">
        <span className="block truncate" title={raw}>
          {raw}
        </span>
      </td>
    </tr>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  PROFESSIONAL_REVIEW_LABEL,
  executionStatusLabel,
  executionStatusVariant,
  isJobInProgress,
  jobStatusLabel,
  jobStatusVariant,
  workPaperExecutionPath,
} from "@/lib/work-papers";
import { workPapersService } from "@/services/work-papers.service";

export function WorkPapersSummaryTable({
  companyId,
  taxPeriodId,
}: {
  companyId: string;
  taxPeriodId: string;
}) {
  const query = useQuery({
    queryKey: ["work-papers-summary", companyId, taxPeriodId],
    queryFn: () => workPapersService.summary(companyId, taxPeriodId),
    refetchInterval: (current) => {
      const rows = current.state.data;
      if (!rows) return false;
      return rows.some((row) => isJobInProgress(row.latestJobStatus))
        ? 2000
        : false;
    },
  });

  if (query.isLoading) {
    return <LoadingState label="Cargando resumen…" />;
  }
  if (query.isError) {
    return (
      <ErrorState
        description="No fue posible cargar el resumen del período."
        onRetry={() => void query.refetch()}
      />
    );
  }
  if (!query.data || query.data.length === 0) return null;

  return (
    <section className="mt-8">
      <header className="mb-3">
        <h2 className="text-xl font-semibold">Resumen de Papeles de Trabajo</h2>
        <p className="mt-1 text-sm text-slate-500">
          Vista consolidada del período. Los ajustes propuestos no son
          determinación F22.
        </p>
      </header>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Papel</th>
              <th className="px-4 py-3">Ejecución</th>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Pendientes</th>
              <th className="px-4 py-3">Conciliaciones</th>
              <th className="px-4 py-3">Revisión</th>
              <th className="px-4 py-3">Ajustes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {query.data.map((row) => (
              <tr key={row.definitionId} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <p className="font-semibold text-emerald-800">{row.code}</p>
                  <p className="text-slate-700">{row.name}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge
                    variant={executionStatusVariant(row.executionStatus)}
                  >
                    {executionStatusLabel(row.executionStatus)}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3">
                  {row.latestJobStatus ? (
                    <StatusBadge
                      variant={jobStatusVariant(row.latestJobStatus)}
                    >
                      {jobStatusLabel(row.latestJobStatus)}
                    </StatusBadge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">{row.missingInputsCount}</td>
                <td className="px-4 py-3">{row.reconciliationWarningsCount}</td>
                <td className="px-4 py-3">
                  {row.requiresProfessionalReview ? (
                    <span className="text-amber-800">
                      {PROFESSIONAL_REVIEW_LABEL}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.proposedAdjustmentsCount > 0 ? (
                    <span>
                      {row.proposedAdjustmentsCount}
                      {row.proposedAdjustmentsTotal
                        ? ` · ${row.proposedAdjustmentsTotal}`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-slate-400">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {row.latestExecutionId ? (
                    <Link
                      href={workPaperExecutionPath(
                        companyId,
                        taxPeriodId,
                        row.latestExecutionId,
                      )}
                      className="font-medium text-emerald-700 hover:underline"
                    >
                      Abrir
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

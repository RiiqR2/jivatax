"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  EMPTY_APPLICABLE_MESSAGE,
  formatAdjustmentsCell,
  formatMetricCount,
  formatProfessionalReviewCell,
  hasCalculatedMetrics,
  isJobInProgress,
  operationalPresentationStatus,
  relatedAccountsForDefinition,
  workPaperExecutionPath,
} from "@/lib/work-papers";
import { workPapersService } from "@/services/work-papers.service";
import type { WorkPaperPeriodSummaryRow } from "@/types/work-papers.types";

function mutationErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return "No fue posible crear el papel de trabajo.";
  }
  const data = error.response?.data as
    { message?: string | string[] } | undefined;
  if (typeof data?.message === "string") return data.message;
  if (Array.isArray(data?.message)) return data.message.join(" ");
  return "No fue posible crear el papel de trabajo.";
}

function DetectedByCell({
  definitionId,
  relatedAccounts,
}: {
  definitionId: string;
  relatedAccounts: ReturnType<typeof relatedAccountsForDefinition>;
}) {
  if (relatedAccounts.length === 0) {
    return <span className="text-slate-400">—</span>;
  }
  return (
    <ul className="space-y-1.5">
      {relatedAccounts.map((account) => (
        <li
          key={`${definitionId}-${account.companyAccountId}-${account.siiAccountCode}`}
        >
          <p className="font-medium text-slate-800">
            {account.companyAccountName}
          </p>
          <p className="text-xs text-slate-600">
            {account.companyAccountCode} · SII {account.siiAccountCode}
          </p>
        </li>
      ))}
    </ul>
  );
}

function WorkPaperRow({
  row,
  companyId,
  taxPeriodId,
  relatedAccounts,
  creating,
  onCreate,
}: {
  row: WorkPaperPeriodSummaryRow;
  companyId: string;
  taxPeriodId: string;
  relatedAccounts: ReturnType<typeof relatedAccountsForDefinition>;
  creating: boolean;
  onCreate: (definitionId: string) => void;
}) {
  const presentation = operationalPresentationStatus(row);
  const showMetrics = hasCalculatedMetrics(row, row.code);

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3">
        <p className="font-semibold text-emerald-800">{row.code}</p>
        <p className="text-slate-700">{row.name}</p>
      </td>
      <td className="px-4 py-3 min-w-[12rem]">
        <DetectedByCell
          definitionId={row.definitionId}
          relatedAccounts={relatedAccounts}
        />
      </td>
      <td className="px-4 py-3">
        <StatusBadge variant={presentation.variant}>
          {presentation.label}
        </StatusBadge>
        {presentation.secondary ? (
          <p className="mt-1 text-xs text-slate-500">
            {presentation.secondary}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        {formatMetricCount(row.missingInputsCount, showMetrics)}
      </td>
      <td className="px-4 py-3">
        {formatMetricCount(row.reconciliationWarningsCount, showMetrics)}
      </td>
      <td className="px-4 py-3">
        {formatProfessionalReviewCell(
          row.requiresProfessionalReview,
          showMetrics,
        )}
      </td>
      <td className="px-4 py-3">{formatAdjustmentsCell(row, showMetrics)}</td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {row.latestExecutionId ? (
          <Button asChild variant="outline">
            <Link
              href={workPaperExecutionPath(
                companyId,
                taxPeriodId,
                row.latestExecutionId,
              )}
            >
              Abrir
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            disabled={creating}
            onClick={() => onCreate(row.definitionId)}
          >
            {creating ? "Creando…" : "Crear papel"}
          </Button>
        )}
      </td>
    </tr>
  );
}

export function WorkPapersList({
  companyId,
  taxPeriodId,
}: {
  companyId: string;
  taxPeriodId: string;
}) {
  const queryClient = useQueryClient();
  const applicable = useQuery({
    queryKey: ["work-papers-applicable", companyId, taxPeriodId],
    queryFn: () => workPapersService.applicable(companyId, taxPeriodId),
  });
  const summary = useQuery({
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
  const create = useMutation({
    mutationFn: (definitionId: string) =>
      workPapersService.createExecution(companyId, taxPeriodId, definitionId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["work-papers-applicable", companyId, taxPeriodId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["work-papers-summary", companyId, taxPeriodId],
        }),
      ]);
    },
  });

  const loading = applicable.isLoading || summary.isLoading;
  const error = applicable.isError || summary.isError;

  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Papeles de trabajo
        </h1>
        <p className="mt-1 text-slate-500">
          Papeles detectados a partir de homologaciones confirmadas de este
          período.
        </p>
      </header>

      {loading ? <LoadingState label="Cargando papeles…" /> : null}
      {error ? (
        <div className="mt-6">
          <ErrorState
            description="No fue posible cargar los papeles de trabajo."
            onRetry={() => {
              void applicable.refetch();
              void summary.refetch();
            }}
          />
        </div>
      ) : null}
      {create.isError ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {mutationErrorMessage(create.error)}
        </p>
      ) : null}

      {summary.data && summary.data.length === 0 ? (
        <p className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {EMPTY_APPLICABLE_MESSAGE}
        </p>
      ) : null}

      {summary.data && summary.data.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Papel</th>
                <th className="px-4 py-3">Detectado por</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Pendientes</th>
                <th className="px-4 py-3">Conciliación</th>
                <th className="px-4 py-3">Revisión</th>
                <th className="px-4 py-3">Ajustes</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {summary.data.map((row) => (
                <WorkPaperRow
                  key={row.definitionId}
                  row={row}
                  companyId={companyId}
                  taxPeriodId={taxPeriodId}
                  relatedAccounts={relatedAccountsForDefinition(
                    applicable.data,
                    row.definitionId,
                  )}
                  creating={
                    create.isPending && create.variables === row.definitionId
                  }
                  onCreate={(definitionId) => create.mutate(definitionId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}

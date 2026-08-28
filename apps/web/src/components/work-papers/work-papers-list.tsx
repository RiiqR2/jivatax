"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  CALCULATOR_NOT_IMPLEMENTED,
  EMPTY_APPLICABLE_MESSAGE,
  hasExecutionHistory,
  listPresentationStatus,
  workPaperExecutionPath,
} from "@/lib/work-papers";
import { workPapersService } from "@/services/work-papers.service";
import type { ApplicableWorkPaper } from "@/types/work-papers.types";
import { WorkPapersSummaryTable } from "@/components/work-papers/work-papers-summary";

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

function PaperCard({
  companyId,
  taxPeriodId,
  paper,
  creating,
  onCreate,
}: {
  companyId: string;
  taxPeriodId: string;
  paper: ApplicableWorkPaper;
  creating: boolean;
  onCreate: (definitionId: string) => void;
}) {
  const presentation = listPresentationStatus(paper.executions);
  const latest = presentation.latest;
  const showCalculatorHint = paper.code !== "A.17";

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-emerald-800">{paper.code}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">
            {paper.name}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Definición v{paper.definitionVersion}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge variant={presentation.variant}>
            {presentation.label}
          </StatusBadge>
          {hasExecutionHistory(paper.executions) ? (
            <span className="text-xs text-slate-500">
              {paper.executions.length} revisiones
            </span>
          ) : null}
        </div>
      </div>

      <ul className="mt-4 space-y-2 text-sm">
        {paper.relatedAccounts.map((account) => (
          <li
            key={`${account.companyAccountId}-${account.siiAccountCode}-${account.roleKey}`}
            className="rounded-lg bg-slate-50 px-3 py-2"
          >
            <p className="font-medium text-slate-800">
              {account.companyAccountCode} · {account.companyAccountName}
            </p>
            <p className="text-slate-600">SII {account.siiAccountCode}</p>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {showCalculatorHint ? (
          <p className="text-xs text-slate-500">{CALCULATOR_NOT_IMPLEMENTED}</p>
        ) : (
          <span />
        )}
        {latest ? (
          <Button asChild>
            <Link
              href={workPaperExecutionPath(companyId, taxPeriodId, latest.id)}
            >
              Abrir
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            disabled={creating}
            onClick={() => onCreate(paper.definitionId)}
          >
            {creating ? "Creando…" : "Crear papel"}
          </Button>
        )}
      </div>
    </article>
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
  const query = useQuery({
    queryKey: ["work-papers-applicable", companyId, taxPeriodId],
    queryFn: () => workPapersService.applicable(companyId, taxPeriodId),
  });
  const create = useMutation({
    mutationFn: (definitionId: string) =>
      workPapersService.createExecution(companyId, taxPeriodId, definitionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["work-papers-applicable", companyId, taxPeriodId],
      });
    },
  });

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

      {query.isLoading ? <LoadingState label="Cargando papeles…" /> : null}
      {query.isError ? (
        <div className="mt-6">
          <ErrorState
            description="No fue posible cargar los papeles de trabajo."
            onRetry={() => void query.refetch()}
          />
        </div>
      ) : null}
      {create.isError ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {mutationErrorMessage(create.error)}
        </p>
      ) : null}

      {query.data && query.data.length === 0 ? (
        <p className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {EMPTY_APPLICABLE_MESSAGE}
        </p>
      ) : null}

      {query.data && query.data.length > 0 ? (
        <>
          <WorkPapersSummaryTable
            companyId={companyId}
            taxPeriodId={taxPeriodId}
          />
          <section className="mt-6 grid gap-4 lg:grid-cols-2">
            {query.data.map((paper) => (
              <PaperCard
                key={paper.definitionId}
                companyId={companyId}
                taxPeriodId={taxPeriodId}
                paper={paper}
                creating={
                  create.isPending && create.variables === paper.definitionId
                }
                onCreate={(definitionId) => create.mutate(definitionId)}
              />
            ))}
          </section>
        </>
      ) : null}
    </main>
  );
}

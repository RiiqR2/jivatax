"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { useState } from "react";
import { A17CalculateForm } from "@/components/work-papers/a17-calculate-form";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  CALCULATOR_NOT_IMPLEMENTED,
  PROFESSIONAL_REVIEW_LABEL,
  canCalculateA17,
  formatRationale,
  inputSourceLabel,
  isAutomaticInput,
  parseResultSnapshot,
  reconciliationVariant,
  relatedAccountsForExecution,
  requiresProfessionalReview,
  workPapersPath,
} from "@/lib/work-papers";
import { workPapersService } from "@/services/work-papers.service";
import type { A17ManualInput } from "@/types/work-papers.types";

function mutationErrorMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) {
    return "No fue posible calcular el papel.";
  }
  const data = error.response?.data as
    { message?: string | string[] } | undefined;
  if (typeof data?.message === "string") return data.message;
  if (Array.isArray(data?.message)) return data.message.join(" ");
  return "No fue posible calcular el papel.";
}

export function WorkPaperExecutionDetail({
  companyId,
  taxPeriodId,
  executionId,
}: {
  companyId: string;
  taxPeriodId: string;
  executionId: string;
}) {
  const queryClient = useQueryClient();
  const [historyOpen, setHistoryOpen] = useState(false);
  const applicable = useQuery({
    queryKey: ["work-papers-applicable", companyId, taxPeriodId],
    queryFn: () => workPapersService.applicable(companyId, taxPeriodId),
  });
  const query = useQuery({
    queryKey: ["work-paper-execution", companyId, taxPeriodId, executionId],
    queryFn: () =>
      workPapersService.execution(companyId, taxPeriodId, executionId),
  });
  const calculate = useMutation({
    mutationFn: (manualInputs: A17ManualInput[]) =>
      workPapersService.calculateA17(
        companyId,
        taxPeriodId,
        executionId,
        manualInputs,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["work-paper-execution", companyId, taxPeriodId, executionId],
      });
    },
  });

  const execution = query.data;
  const snapshot = execution
    ? parseResultSnapshot(execution.resultSnapshot)
    : null;
  const relatedAccounts = execution
    ? relatedAccountsForExecution(applicable.data, execution.definitionId)
    : [];
  const showCalculate =
    execution != null &&
    canCalculateA17({
      definitionCode: execution.definition.code,
      status: execution.status,
    });

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-5 sm:p-8">
      <Link
        href={workPapersPath(companyId, taxPeriodId)}
        className="text-sm text-emerald-700"
      >
        ← Volver a papeles de trabajo
      </Link>

      {query.isLoading ? <LoadingState label="Cargando ejecución…" /> : null}
      {query.isError ? (
        <ErrorState
          description="No fue posible cargar la ejecución."
          onRetry={() => void query.refetch()}
        />
      ) : null}

      {execution && snapshot ? (
        <>
          <header className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  {execution.definition.code}
                </p>
                <h1 className="mt-1 text-2xl font-semibold">
                  {execution.definition.name}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Revisión {execution.revision}
                  {execution.finalizedAt
                    ? ` · Finalizado ${new Date(execution.finalizedAt).toLocaleString("es-CL")}`
                    : ""}
                </p>
              </div>
              <StatusBadge
                variant={
                  execution.status === "finalized" ? "success" : "warning"
                }
              >
                {execution.status === "finalized" ? "Finalizado" : "Borrador"}
              </StatusBadge>
            </div>
            {requiresProfessionalReview(snapshot) ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {PROFESSIONAL_REVIEW_LABEL}
              </p>
            ) : null}
            {execution.definition.code !== "A.17" ? (
              <p className="mt-4 text-sm text-slate-500">
                {CALCULATOR_NOT_IMPLEMENTED}
              </p>
            ) : null}
          </header>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">
              Cuentas que originaron applicability
            </h2>
            {relatedAccounts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                No hay cuentas asociadas en la detección actual.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {relatedAccounts.map((account) => (
                  <li
                    key={`${account.companyAccountId}-${account.siiAccountCode}`}
                  >
                    {account.companyAccountCode} · {account.companyAccountName}{" "}
                    · SII {account.siiAccountCode}
                    {formatRationale(account.rationale)
                      ? ` · ${formatRationale(account.rationale)}`
                      : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Inputs</h2>
            {execution.inputs.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Esta ejecución aún no tiene inputs calculados.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Clave</th>
                      <th className="py-2 pr-4">Origen</th>
                      <th className="py-2 pr-4">Valor</th>
                      <th className="py-2">Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execution.inputs.map((input) => (
                      <tr key={input.id} className="border-t border-slate-100">
                        <td className="py-2 pr-4 font-mono text-xs">
                          {input.inputKey}
                        </td>
                        <td className="py-2 pr-4">
                          <StatusBadge
                            variant={
                              isAutomaticInput(input.sourceType)
                                ? "info"
                                : "neutral"
                            }
                          >
                            {inputSourceLabel(input.sourceType)}
                          </StatusBadge>
                        </td>
                        <td className="py-2 pr-4">
                          {input.valueSnapshot ?? "—"}
                        </td>
                        <td className="py-2 text-slate-600">
                          {typeof input.payloadSnapshot?.description ===
                          "string"
                            ? input.payloadSnapshot.description
                            : (input.sourceEntityType ?? "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {snapshot.missingInputs.length > 0 ? (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h2 className="font-semibold text-amber-950">
                Antecedentes pendientes
              </h2>
              <ul className="mt-2 list-disc pl-5 font-mono text-sm text-amber-900">
                {snapshot.missingInputs.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {snapshot.reconciliations.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Reconciliaciones</h2>
              <div className="mt-3 space-y-3">
                {snapshot.reconciliations.map((item) => (
                  <article
                    key={item.key}
                    className="rounded-lg border border-slate-100 p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-xs">{item.key}</p>
                      <StatusBadge variant={reconciliationVariant(item.status)}>
                        {item.status}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 text-slate-700">
                      Calculado {item.calculatedAmount} · Reportado{" "}
                      {item.reportedAmount} · Diferencia {item.difference}
                    </p>
                    {item.messages.length > 0 ? (
                      <ul className="mt-2 list-disc pl-5 text-slate-600">
                        {item.messages.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {snapshot.warnings.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold">Advertencias</h2>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                {snapshot.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Ajustes tributarios propuestos</h2>
            {execution.status !== "finalized" ? (
              <p className="mt-1 text-sm text-slate-500">
                Propuestas en borrador. No corresponden a F22 definitivo.
              </p>
            ) : null}
            {execution.adjustments.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin ajustes.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {execution.adjustments.map((adjustment) => (
                  <li
                    key={adjustment.id}
                    className="rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <p className="font-medium">
                      {adjustment.type} · {adjustment.amount}
                    </p>
                    <p className="text-slate-600">{adjustment.description}</p>
                    {adjustment.differenceNature ? (
                      <p className="text-xs text-slate-500">
                        Naturaleza: {adjustment.differenceNature}
                      </p>
                    ) : null}
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      {adjustment.ruleKey}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold">Evidencia</h2>
            {execution.evidence.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                Sin evidencia vigente.
              </p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {execution.evidence.map((item) => (
                  <li key={item.id}>
                    {item.evidenceType} · {item.sourceEntityType}
                    {item.description ? ` · ${item.description}` : ""}
                  </li>
                ))}
              </ul>
            )}
            {execution.historicalEvidence.length > 0 ? (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setHistoryOpen((open) => !open)}
                >
                  {historyOpen
                    ? "Ocultar evidencia histórica"
                    : "Ver evidencia histórica"}
                </Button>
                {historyOpen ? (
                  <ul className="mt-2 space-y-2 text-sm text-slate-500">
                    {execution.historicalEvidence.map((item) => (
                      <li key={item.id}>
                        {item.evidenceType} · {item.sourceEntityType}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>

          {showCalculate ? (
            <A17CalculateForm
              pending={calculate.isPending}
              error={
                calculate.isError ? mutationErrorMessage(calculate.error) : null
              }
              onSubmit={(manualInputs) => calculate.mutate(manualInputs)}
            />
          ) : null}
        </>
      ) : null}
    </main>
  );
}

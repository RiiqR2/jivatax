"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  useAccountPlanVersion,
  useCompanyAccounts,
  useMappingActions,
} from "@/hooks/use-company-account-plan";
import type { CompanyAccountMappingStatus } from "@/types/company-account-plan.types";

const labels: Record<CompanyAccountMappingStatus, string> = {
  suggested: "Sugerido",
  confirmed: "Confirmado",
  rejected: "Rechazado",
  unmapped: "Sin mapear",
};

export function AccountPlanReview({
  companyId,
  versionId,
}: {
  companyId: string;
  versionId: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<
    CompanyAccountMappingStatus | undefined
  >();
  const version = useAccountPlanVersion(companyId, versionId);
  const accounts = useCompanyAccounts(companyId, versionId, {
    search,
    mappingStatus: status,
    pageSize: 50,
  });
  const actions = useMappingActions(companyId, versionId);
  if (version.isPending || accounts.isPending) {
    return <LoadingState label="Cargando correspondencias…" />;
  }
  if (version.isError || accounts.isError) {
    return (
      <ErrorState
        title="No fue posible cargar la versión"
        description="Verifica tu acceso e intenta nuevamente."
      />
    );
  }
  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      <PageHeader
        title={version.data.name}
        description="Las puntuaciones son heurísticas y ninguna sugerencia se confirma automáticamente."
      />
      <div className="mt-6 flex flex-wrap gap-3">
        <input
          className="rounded-lg border px-3 py-2 text-sm"
          placeholder="Buscar código o nombre"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="rounded-lg border px-3 py-2 text-sm"
          value={status ?? ""}
          onChange={(event) =>
            setStatus(
              (event.target.value || undefined) as
                CompanyAccountMappingStatus | undefined,
            )
          }
        >
          <option value="">Todos</option>
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-5 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3">Código interno</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Cuenta SII</th>
              <th className="p-3">Método</th>
              <th className="p-3">Confianza</th>
              <th className="p-3">Estado</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {accounts.data.items.map((account) => {
              const mapping = account.mapping;
              return (
                <tr key={account.id} className="border-t align-top">
                  <td className="p-3 font-mono">{account.internalCode}</td>
                  <td className="p-3">{account.name}</td>
                  <td className="p-3">
                    {mapping?.siiAccount
                      ? `${mapping.siiAccount.code} · ${mapping.siiAccount.name}`
                      : "—"}
                  </td>
                  <td className="p-3">{mapping?.method ?? "—"}</td>
                  <td className="p-3">
                    {mapping?.confidence === null || !mapping
                      ? "—"
                      : `${Math.round(mapping.confidence * 100)}% heurístico`}
                  </td>
                  <td className="p-3">
                    {mapping ? labels[mapping.status] : "Sin mapear"}
                  </td>
                  <td className="p-3">
                    {mapping && (
                      <div className="flex flex-wrap gap-2">
                        {mapping.siiAccount && (
                          <Button
                            className="h-8 px-3 text-xs"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Esta acción marcará la correspondencia como revisada.",
                                )
                              ) {
                                actions.confirm.mutate({
                                  mappingId: mapping.id,
                                  input: {},
                                });
                              }
                            }}
                          >
                            Confirmar
                          </Button>
                        )}
                        <Button
                          className="h-8 px-3 text-xs"
                          variant="outline"
                          onClick={() => {
                            const notes = window.prompt(
                              "Nota opcional para el rechazo:",
                            );
                            if (notes !== null) {
                              actions.reject.mutate({
                                mappingId: mapping.id,
                                input: {
                                  notes: notes || undefined,
                                },
                              });
                            }
                          }}
                        >
                          Rechazar
                        </Button>
                        <Button
                          className="h-8 px-3 text-xs"
                          variant="outline"
                          onClick={() => actions.unmap.mutate(mapping.id)}
                        >
                          Sin mapear
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

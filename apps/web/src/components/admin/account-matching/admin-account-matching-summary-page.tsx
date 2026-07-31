"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import {
  useAdminAccountMatchingCoverage,
  useAdminSiiAccountPlanVersions,
} from "@/hooks/admin/use-admin-sii-account-plan";

export function AdminAccountMatchingSummaryPage() {
  const versions = useAdminSiiAccountPlanVersions();
  const [versionId, setVersionId] = useState("");
  const [search, setSearch] = useState("");
  const coverage = useAdminAccountMatchingCoverage(versionId);

  useEffect(() => {
    if (!versionId && versions.data?.length) setVersionId(versions.data[0].id);
  }, [versionId, versions.data]);

  const filteredAccounts = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es-CL");
    if (!normalizedSearch) return coverage.data?.accounts ?? [];
    return (coverage.data?.accounts ?? []).filter(
      (account) =>
        account.code.toLocaleLowerCase("es-CL").includes(normalizedSearch) ||
        account.name.toLocaleLowerCase("es-CL").includes(normalizedSearch),
    );
  }, [coverage.data?.accounts, search]);

  return (
    <main className="mx-auto w-full max-w-7xl p-5 sm:p-8">
      <PageHeader
        title="Resumen de homologación"
        description="Revisa la cobertura de aliases, conceptos y aprendizaje del catálogo SII."
      />

      {versions.isPending ? (
        <div className="mt-6">
          <LoadingState label="Cargando versiones…" />
        </div>
      ) : versions.isError ? (
        <div className="mt-6">
          <ErrorState
            description="No fue posible cargar las versiones del plan SII."
            onRetry={() => versions.refetch()}
          />
        </div>
      ) : versions.data.length === 0 ? (
        <EmptyState message="No hay versiones del plan de cuentas SII disponibles." />
      ) : (
        <>
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="coverage-version"
            >
              Versión del catálogo
            </label>
            <select
              id="coverage-version"
              value={versionId}
              onChange={(event) => setVersionId(event.target.value)}
              className="mt-1 h-11 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3"
            >
              {versions.data.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.code} — {version.name}
                </option>
              ))}
            </select>
          </section>

          {coverage.isPending ? (
            <div className="mt-6">
              <LoadingState label="Calculando cobertura…" />
            </div>
          ) : coverage.isError ? (
            <div className="mt-6">
              <ErrorState
                description="No fue posible cargar el resumen de homologación."
                onRetry={() => coverage.refetch()}
              />
            </div>
          ) : coverage.data ? (
            <>
              <section
                aria-label="Indicadores de cobertura"
                className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <Metric
                  label="Cuentas del catálogo"
                  value={coverage.data.total}
                />
                <Metric
                  label="Con aliases"
                  value={coverage.data.withAliases}
                  detail={`${coverage.data.withoutAliases} sin aliases`}
                />
                <Metric
                  label="Con conceptos"
                  value={coverage.data.withConcepts}
                  detail={`${coverage.data.withoutConcepts} sin conceptos`}
                />
                <Metric
                  label="Usadas en aprendizaje"
                  value={coverage.data.usedInLearning}
                  detail={`${coverage.data.neverUsedInLearning} nunca utilizadas`}
                />
                <Metric
                  label="Decisiones ambiguas"
                  value={coverage.data.ambiguous}
                />
                <Metric
                  label="Revisiones manuales"
                  value={coverage.data.manuallyReviewed}
                />
                <Metric
                  label="Corregidas tras revisión"
                  value={coverage.data.correctedAfterReview}
                />
              </section>

              <section className="mt-8">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-950">
                      Detalle del catálogo
                    </h2>
                    <p className="text-sm text-slate-500">
                      Señales disponibles para cada cuenta SII.
                    </p>
                  </div>
                  <div className="w-full max-w-md">
                    <SearchInput
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar por código o glosa"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Glosa</th>
                        <th>Aliases</th>
                        <th>Conceptos</th>
                        <th>Aprendizaje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((account) => (
                        <tr key={account.code}>
                          <td className="font-medium text-slate-900">
                            {account.code}
                          </td>
                          <td>{account.name}</td>
                          <td>
                            <Availability available={account.hasAliases} />
                          </td>
                          <td>
                            <Availability available={account.hasConcepts} />
                          </td>
                          <td>
                            <Availability available={account.usedInLearning} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {filteredAccounts.length} cuentas visibles
                </p>
              </section>
            </>
          ) : null}
        </>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-950">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </article>
  );
}

function Availability({ available }: { available: boolean }) {
  return (
    <span
      className={available ? "font-medium text-emerald-700" : "text-slate-400"}
    >
      {available ? "Disponible" : "Sin evidencia"}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

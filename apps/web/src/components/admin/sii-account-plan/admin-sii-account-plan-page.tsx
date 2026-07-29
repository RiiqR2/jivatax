"use client";

import { useEffect, useState } from "react";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import {
  useAdminSiiAccountPlanVersions,
  useAdminSiiAccounts,
} from "@/hooks/admin/use-admin-sii-account-plan";

const pageSize = 50;

export function AdminSiiAccountPlanPage() {
  const versions = useAdminSiiAccountPlanVersions();
  const [versionId, setVersionId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!versionId && versions.data?.length) {
      setVersionId(versions.data[0].id);
    }
  }, [versionId, versions.data]);

  const accounts = useAdminSiiAccounts(versionId, {
    page,
    limit: pageSize,
    ...(search ? { search } : {}),
  });
  const selectedVersion = versions.data?.find(
    (version) => version.id === versionId,
  );

  return (
    <main className="mx-auto w-full max-w-7xl p-5 sm:p-8">
      <PageHeader
        title="Plan de cuentas SII"
        description="Consulta las versiones oficiales y sus cuentas contables."
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
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="font-semibold text-slate-900">No hay versiones</h2>
          <p className="mt-1 text-sm text-slate-500">
            Aún no se han importado versiones del plan de cuentas SII.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <label
              className="text-sm font-medium text-slate-800"
              htmlFor="sii-version"
            >
              Versión
            </label>
            <select
              id="sii-version"
              value={versionId}
              onChange={(event) => {
                setVersionId(event.target.value);
                setPage(1);
              }}
              className="mt-1 h-11 w-full max-w-xl rounded-lg border border-slate-300 bg-white px-3"
            >
              {versions.data.map((version) => (
                <option key={version.id} value={version.id}>
                  {version.code} — {version.name}
                </option>
              ))}
            </select>
            {selectedVersion && (
              <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                <p>
                  <span className="text-slate-500">Nombre:</span>{" "}
                  <strong>{selectedVersion.name}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Código:</span>{" "}
                  <strong>{selectedVersion.code}</strong>
                </p>
                <p>
                  <span className="text-slate-500">Total de cuentas:</span>{" "}
                  <strong>{selectedVersion.accountCount}</strong>
                </p>
              </div>
            )}
          </section>
          <div className="my-6 max-w-md">
            <SearchInput
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por código o glosa"
            />
          </div>
          {accounts.isPending ? (
            <LoadingState label="Cargando cuentas…" />
          ) : accounts.isError ? (
            <ErrorState
              description="No fue posible cargar las cuentas de esta versión."
              onRetry={() => accounts.refetch()}
            />
          ) : accounts.data.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <h2 className="font-semibold text-slate-900">
                No se encontraron cuentas
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Ajusta la búsqueda para ver otros resultados.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Glosa</th>
                      <th>Orden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.data.items.map((account) => (
                      <tr key={account.id}>
                        <td className="font-medium text-slate-900">
                          {account.code}
                        </td>
                        <td>{account.name}</td>
                        <td>{account.sortOrder}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {accounts.data.total} cuentas
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page * accounts.data.limit >= accounts.data.total}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

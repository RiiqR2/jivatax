"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { useCompany } from "@/hooks/use-companies";
import { useAccountPlanVersions } from "@/hooks/use-company-account-plan";

export function AccountPlanOverview({ companyId }: { companyId: string }) {
  const company = useCompany(companyId);
  const versions = useAccountPlanVersions(companyId);
  if (company.isPending || versions.isPending) {
    return <LoadingState label="Cargando plan de cuentas…" />;
  }
  if (company.isError || versions.isError) {
    return (
      <ErrorState
        title="No fue posible cargar el plan de cuentas"
        description="Intenta nuevamente o verifica tu acceso a la empresa."
      />
    );
  }
  const current = versions.data.items.find(
    (version) => version.status === "ready",
  );
  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8">
      <PageHeader
        title="Plan de cuentas"
        description={company.data.legalName}
        actions={
          <Button asChild>
            <Link href={`/companies/${companyId}/account-plan/import`}>
              Importar plan de cuentas
            </Link>
          </Button>
        }
      />
      {!versions.data.items.length ? (
        <div className="mt-8">
          <EmptyState
            icon={BookOpen}
            title="No hay un plan de cuentas cargado"
            description="Importa el plan de cuentas interno de la empresa para comenzar a relacionarlo con el catálogo del SII."
            action={
              <Button asChild>
                <Link href={`/companies/${companyId}/account-plan/import`}>
                  Importar plan de cuentas
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-4">
            <Summary
              label="Versión vigente"
              value={current?.name ?? "Sin versión ready"}
            />
            <Summary label="Cuentas" value={String(current?.validRows ?? 0)} />
            <Summary label="Estado" value={current?.status ?? "—"} />
            <Summary
              label="Versiones"
              value={String(versions.data.items.length)}
            />
          </section>
          <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b p-4 font-semibold">
              Historial de versiones
            </h2>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Archivo</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Cuentas</th>
                  <th className="p-3">Acción</th>
                </tr>
              </thead>
              <tbody>
                {versions.data.items.map((version) => (
                  <tr key={version.id} className="border-t">
                    <td className="p-3 font-medium">{version.name}</td>
                    <td className="p-3">{version.sourceFileName}</td>
                    <td className="p-3">{version.status}</td>
                    <td className="p-3">{version.validRows}</td>
                    <td className="p-3">
                      <Link
                        className="text-emerald-700 underline"
                        href={`/companies/${companyId}/account-plan/${version.id}`}
                      >
                        Revisar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-2 font-semibold text-slate-900">{value}</p>
    </article>
  );
}

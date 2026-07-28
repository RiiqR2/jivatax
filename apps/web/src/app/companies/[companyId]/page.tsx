"use client";
import Link from "next/link";
import { use } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { useCompany } from "@/hooks/use-companies";
export default function CompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = use(params);
  const company = useCompany(companyId);
  if (company.isPending) return <LoadingState label="Cargando empresa…" />;
  if (company.isError)
    return (
      <main className="mx-auto max-w-4xl p-8">
        <ErrorState
          title="Empresa no encontrada"
          description="La empresa no existe o no pertenece a tu organización activa."
        />
      </main>
    );
  return (
    <main className="mx-auto max-w-4xl p-5 sm:p-8">
      <PageHeader
        title={company.data.legalName}
        description={`RUT ${company.data.taxId}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/companies">Volver a empresas</Link>
          </Button>
        }
      />
      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-8 text-center">
        <FileText className="mx-auto size-10 text-emerald-700" />
        <h2 className="mt-4 text-lg font-semibold">Documentos tributarios</h2>
        <p className="mt-1 text-sm text-slate-500">
          Continúa al módulo de documentos de esta empresa.
        </p>
        <Button className="mt-5" asChild>
          <Link href={`/companies/${companyId}/files`}>Documentos</Link>
        </Button>
      </section>
    </main>
  );
}

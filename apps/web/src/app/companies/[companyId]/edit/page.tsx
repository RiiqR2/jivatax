"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import { CompanyForm } from "@/components/companies/company-form";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { useCompany, useUpdateCompany } from "@/hooks/use-companies";
export default function EditCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = use(params);
  const company = useCompany(companyId);
  const mutation = useUpdateCompany(companyId);
  const router = useRouter();
  if (company.isPending) return <LoadingState label="Cargando empresa…" />;
  if (company.isError)
    return (
      <main className="mx-auto max-w-3xl p-8">
        <ErrorState
          title="Empresa no encontrada"
          description="La empresa no existe o no pertenece a tu organización activa."
        />
      </main>
    );
  return (
    <main className="mx-auto w-full max-w-3xl p-5 sm:p-8">
      <PageHeader
        title="Editar empresa"
        description="Actualiza la información tributaria de la empresa."
      />
      <div className="mt-6">
        <CompanyForm
          company={company.data}
          isPending={mutation.isPending}
          onSubmit={async (values) => {
            await mutation.mutateAsync(values);
            router.push("/companies?updated=1");
          }}
        />
      </div>
    </main>
  );
}

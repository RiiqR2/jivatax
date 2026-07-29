"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { CompanyForm } from "@/components/companies/company-form";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  useAdminCompany,
  useUpdateAdminCompany,
} from "@/hooks/admin/use-admin-companies";

export default function EditAdminCompanyPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = use(params);
  const company = useAdminCompany(companyId);
  const mutation = useUpdateAdminCompany(companyId);
  const router = useRouter();

  if (company.isPending) {
    return <LoadingState label="Cargando empresa…" />;
  }
  if (company.isError) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <ErrorState
          title="Empresa no encontrada"
          description="La empresa no existe o no está disponible."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-5 sm:p-8">
      <PageHeader
        title="Editar empresa"
        description="Actualiza la información y el estado de la empresa."
      />
      <div className="mt-6">
        <CompanyForm
          company={company.data}
          cancelHref="/admin/companies"
          isPending={mutation.isPending}
          onSubmit={async (input) => {
            await mutation.mutateAsync(input);
            router.push("/admin/companies?updated=1");
          }}
        />
      </div>
    </main>
  );
}

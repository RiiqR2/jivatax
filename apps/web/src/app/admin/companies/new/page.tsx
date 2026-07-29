"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CompanyForm } from "@/components/companies/company-form";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { useCreateAdminCompany } from "@/hooks/admin/use-admin-companies";
import { useAdminOrganizations } from "@/hooks/admin/use-admin-organizations";

export default function NewAdminCompanyPage() {
  const organizations = useAdminOrganizations();
  const mutation = useCreateAdminCompany();
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState("");

  if (organizations.isPending) {
    return <LoadingState label="Cargando organizaciones…" />;
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-5 sm:p-8">
      <PageHeader
        title="Nueva empresa"
        description="Registra una empresa en una organización de la plataforma."
      />
      <div className="mt-6 space-y-5">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label
            className="text-sm font-medium text-slate-800"
            htmlFor="organization"
          >
            Organización
          </label>
          <select
            id="organization"
            value={organizationId}
            onChange={(event) => setOrganizationId(event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
            required
          >
            <option value="">Selecciona una organización</option>
            {organizations.data?.items.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </div>
        <CompanyForm
          cancelHref="/admin/companies"
          isPending={mutation.isPending}
          onSubmit={async (input) => {
            if (!organizationId) {
              throw new Error("Selecciona una organización.");
            }
            await mutation.mutateAsync({ organizationId, input });
            router.push("/admin/companies?created=1");
          }}
        />
      </div>
    </main>
  );
}

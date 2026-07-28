"use client";
import { useRouter } from "next/navigation";
import { CompanyForm } from "@/components/companies/company-form";
import { PageHeader } from "@/components/shared/page-header";
import { useCreateCompany } from "@/hooks/use-companies";
export default function NewCompanyPage() {
  const mutation = useCreateCompany();
  const router = useRouter();
  return (
    <main className="mx-auto w-full max-w-3xl p-5 sm:p-8">
      <PageHeader
        title="Nueva empresa"
        description="Registra una empresa en tu organización activa."
      />
      <div className="mt-6">
        <CompanyForm
          isPending={mutation.isPending}
          onSubmit={async (values) => {
            await mutation.mutateAsync(values);
            router.push("/companies?created=1");
          }}
        />
      </div>
    </main>
  );
}

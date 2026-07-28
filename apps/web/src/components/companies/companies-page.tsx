"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { useCompanies } from "@/hooks/use-companies";
import { useSession } from "@/hooks/use-session";
import { CompanyList } from "./company-list";
export function CompaniesPage() {
  const [search, setSearch] = useState("");
  const companies = useCompanies(search ? { search } : {});
  const session = useSession();
  const canEdit =
    session.data?.organization?.role === "owner" ||
    session.data?.organization?.role === "admin";
  return (
    <main className="mx-auto w-full max-w-7xl p-5 sm:p-8">
      <PageHeader
        title="Empresas"
        description="Administra las empresas de tu organización activa."
        actions={
          canEdit ? (
            <Button asChild>
              <Link href="/companies/new">
                <Plus className="mr-2 size-4" />
                Nueva empresa
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="my-6 max-w-md">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por razón social, nombre o RUT"
        />
      </div>
      {companies.isPending ? (
        <LoadingState label="Cargando empresas…" />
      ) : companies.isError ? (
        <ErrorState
          description="No fue posible cargar las empresas."
          onRetry={() => companies.refetch()}
        />
      ) : (
        <CompanyList companies={companies.data.items} canEdit={canEdit} />
      )}
    </main>
  );
}

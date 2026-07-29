"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";
import { CompanyList } from "@/components/companies/company-list";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { useAdminCompanies } from "@/hooks/admin/use-admin-companies";

export function AdminCompaniesPage() {
  const [search, setSearch] = useState("");
  const companies = useAdminCompanies(search ? { search } : {});

  return (
    <main className="mx-auto w-full max-w-7xl p-5 sm:p-8">
      <PageHeader
        title="Administración de empresas"
        description="Gestiona todas las empresas registradas en la plataforma."
        actions={
          <Button asChild>
            <Link href="/admin/companies/new">
              <Plus className="mr-2 size-4" />
              Nueva empresa
            </Link>
          </Button>
        }
      />
      <div className="my-6 max-w-md">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por razón social, nombre de fantasía o RUT"
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
        <CompanyList companies={companies.data.items} canEdit admin />
      )}
    </main>
  );
}

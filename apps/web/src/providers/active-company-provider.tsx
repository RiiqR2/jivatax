"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, type ReactNode } from "react";
import { activeCompaniesService } from "@/services/active-companies.service";
import type { AvailableCompany } from "@/types/active-company.types";

interface ActiveCompanyContextValue {
  activeCompany: AvailableCompany | null;
  availableCompanies: AvailableCompany[];
  selectCompany: (companyId: string) => void;
  loading: boolean;
  error: boolean;
  requestedCompanyId: string | null;
}

const ActiveCompanyContext = createContext<ActiveCompanyContextValue | null>(
  null,
);

export function ActiveCompanyProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const companyId = pathname.match(/^\/companies\/([^/]+)/)?.[1] ?? null;
  const companies = useQuery({
    queryKey: ["auth", "me", "companies"],
    queryFn: activeCompaniesService.list,
    retry: false,
  });
  const availableCompanies = companies.data ?? [];
  const activeCompany =
    availableCompanies.find((company) => company.id === companyId) ?? null;
  const selectCompany = useCallback(
    (selectedCompanyId: string) => {
      router.push(`/companies/${selectedCompanyId}/dashboard`);
    },
    [router],
  );

  return (
    <ActiveCompanyContext.Provider
      value={{
        activeCompany,
        availableCompanies,
        selectCompany,
        loading: companies.isPending,
        error: companies.isError,
        requestedCompanyId: companyId,
      }}
    >
      {children}
    </ActiveCompanyContext.Provider>
  );
}

export function useActiveCompany() {
  const context = useContext(ActiveCompanyContext);
  if (!context) {
    throw new Error("useActiveCompany debe usarse dentro del provider.");
  }
  return context;
}

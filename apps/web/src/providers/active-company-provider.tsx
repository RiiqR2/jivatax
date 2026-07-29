"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
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
  const isAdmin = pathname.startsWith("/admin");
  const companyId = pathname.match(/^\/companies\/([^/]+)/)?.[1] ?? null;
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    companyId,
  );

  useEffect(() => {
    if (companyId) {
      setActiveCompanyId(companyId);
    }
  }, [companyId]);

  const companies = useQuery({
    queryKey: ["auth", "me", "companies"],
    queryFn: activeCompaniesService.list,
    retry: false,
    enabled: !isAdmin,
  });
  const availableCompanies = companies.data ?? [];
  const resolvedCompanyId = companyId ?? activeCompanyId;
  const activeCompany =
    availableCompanies.find((company) => company.id === resolvedCompanyId) ??
    null;
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
        loading: companies.isLoading,
        error: !isAdmin && companies.isError,
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

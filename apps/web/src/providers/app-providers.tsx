"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ActiveCompanyProvider } from "@/providers/active-company-provider";

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <QueryProvider>
      <AuthProvider>
        <ActiveCompanyProvider>{children}</ActiveCompanyProvider>
      </AuthProvider>
    </QueryProvider>
  );
}

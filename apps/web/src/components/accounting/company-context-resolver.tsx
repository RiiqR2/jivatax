"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { companyEntryPath } from "@/lib/accounting-navigation";
import { accountingService } from "@/services/accounting.service";

export function CompanyContextResolver({
  companyId,
  section = "dashboard",
}: {
  companyId: string;
  section?: "dashboard" | "documents";
}) {
  const router = useRouter();
  const periods = useQuery({
    queryKey: ["tax-periods", companyId],
    queryFn: () => accountingService.periods(companyId),
  });

  useEffect(() => {
    if (periods.data) {
      router.replace(companyEntryPath(companyId, periods.data, section));
    }
  }, [companyId, periods.data, router, section]);

  if (periods.isError) {
    return (
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center p-6">
        <p className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
          No pudimos resolver los períodos tributarios de esta empresa.
        </p>
      </main>
    );
  }

  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center">
      <div className="flex items-center gap-3 text-sm text-slate-600">
        <LoaderCircle className="size-5 animate-spin text-emerald-700" />
        Preparando el contexto tributario…
      </div>
    </main>
  );
}

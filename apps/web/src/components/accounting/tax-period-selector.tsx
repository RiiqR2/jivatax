"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarRange } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { accountingService } from "@/services/accounting.service";
import { periodSelectionPath } from "@/lib/accounting-navigation";

const statusLabel = {
  open: "Abierto",
  processing: "Procesando",
  reviewed: "Revisado",
  closed: "Cerrado",
};

export function TaxPeriodSelector({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const selected = pathname.match(/\/periods\/([^/]+)/)?.[1] ?? "";
  const periods = useQuery({
    queryKey: ["tax-periods", companyId],
    queryFn: () => accountingService.periods(companyId),
  });

  const choose = (periodId: string) => {
    if (periodId === "setup") {
      router.push(`/companies/${companyId}/periods/setup`);
      return;
    }

    window.localStorage.setItem("jivatax.lastCompanyId", companyId);
    window.localStorage.setItem("jivatax.lastTaxPeriodId", periodId);
    router.push(periodSelectionPath(pathname, companyId, periodId));
  };

  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
      <CalendarRange className="size-4 text-emerald-700" />
      <span className="sr-only">Período tributario</span>
      <select
        value={selected}
        onChange={(event) => choose(event.target.value)}
        className="max-w-64 bg-white outline-none"
        disabled={periods.isLoading}
      >
        {!periods.data?.length && (
          <option value="">Sin períodos tributarios</option>
        )}
        {periods.data?.map((period) => (
          <option key={period.id} value={period.id}>
            AT {period.taxYear} · Comercial {period.commercialYear} ·{" "}
            {statusLabel[period.status]}
          </option>
        ))}
        <option value="setup">Crear período tributario…</option>
      </select>
    </label>
  );
}

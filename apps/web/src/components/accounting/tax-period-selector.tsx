"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarRange } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { accountingService } from "@/services/accounting.service";

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
    const section =
      pathname.match(/\/(dashboard|documents|users|account-mapping)$/)?.[1] ??
      "dashboard";
    router.push(`/companies/${companyId}/periods/${periodId}/${section}`);
  };

  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
      <CalendarRange className="size-4 text-emerald-700" />
      <span className="sr-only">Período tributario</span>
      <select
        value={selected}
        onChange={(event) => choose(event.target.value)}
        className="max-w-64 bg-white outline-none"
        disabled={periods.isLoading || !periods.data?.length}
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
      </select>
    </label>
  );
}

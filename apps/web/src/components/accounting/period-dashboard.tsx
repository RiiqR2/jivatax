"use client";

import { CheckCircle2, Clock3, FileCheck2, ListChecks } from "lucide-react";
import { getDemoDashboardData } from "@/lib/demo-dashboard-data";

export function PeriodDashboard({
  companyId,
  taxPeriodId,
}: {
  companyId: string;
  taxPeriodId: string;
}) {
  const data = getDemoDashboardData(`${companyId}:${taxPeriodId}`);
  const cards = [
    {
      label: "Documentos procesados",
      value: data.documentsProcessed.toLocaleString("es-CL"),
      icon: FileCheck2,
    },
    {
      label: "Cuentas homologadas",
      value: `${data.mappedAccountsPercentage}%`,
      icon: ListChecks,
    },
    {
      label: "Revisiones pendientes",
      value: data.pendingReviews,
      icon: Clock3,
    },
    {
      label: "Avance tributario",
      value: `${data.taxBalanceProgress}%`,
      icon: CheckCircle2,
    },
  ];

  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      <p className="text-sm font-medium text-emerald-700">
        Período tributario activo
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Resumen</h1>
      <p className="mt-1 text-slate-500">
        Estado de la operación contable y tributaria del período seleccionado.
      </p>
      <section className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{card.label}</p>
              <card.icon className="size-5 text-emerald-700" />
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {card.value}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}

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
      label: "Avance Balance Tributario",
      value: `${data.taxBalanceProgress}%`,
      icon: CheckCircle2,
    },
  ];
  const maximum = Math.max(
    ...data.monthlyDocuments.map((item) => item.documents),
  );

  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Resumen</h1>
        <p className="mt-1 text-slate-500">
          Estado general de la operación tributaria de la empresa.
        </p>
      </div>
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
      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-6 xl:col-span-2">
          <h2 className="font-semibold">Documentos procesados por mes</h2>
          <div
            className="mt-8 flex h-56 items-end gap-3"
            role="img"
            aria-label="Gráfico de documentos procesados por mes"
          >
            {data.monthlyDocuments.map((item) => (
              <div
                key={item.month}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <span className="text-xs font-medium text-slate-600">
                  {item.documents}
                </span>
                <div
                  className="w-full max-w-14 rounded-t-md bg-emerald-600 transition-all"
                  style={{ height: `${(item.documents / maximum) * 80}%` }}
                />
                <span className="text-xs text-slate-500">{item.month}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">Estado de homologación</h2>
          <div className="mt-8 flex h-5 overflow-hidden rounded-full bg-slate-100">
            {data.mappingStatus.map((status) => (
              <div
                key={status.label}
                className={status.color}
                style={{ width: `${status.value}%` }}
              />
            ))}
          </div>
          <div className="mt-6 space-y-4">
            {data.mappingStatus.map((status) => (
              <div key={status.label} className="flex justify-between text-sm">
                <span className="text-slate-600">{status.label}</span>
                <strong>{status.value}%</strong>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">Avance del proceso tributario</h2>
          <div className="mt-8 flex items-center gap-5">
            <div className="relative grid size-32 place-items-center rounded-full bg-emerald-50">
              <span className="text-3xl font-semibold text-emerald-800">
                {data.taxBalanceProgress}%
              </span>
            </div>
            <p className="max-w-xs text-sm leading-6 text-slate-600">
              Progreso estimado para completar el Balance Tributario de esta
              empresa.
            </p>
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">Actividad reciente</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {data.recentActivity.map((activity) => (
              <div key={activity.title} className="py-4 first:pt-0">
                <div className="flex justify-between gap-4">
                  <p className="text-sm font-medium">{activity.title}</p>
                  <span className="shrink-0 text-xs text-slate-400">
                    {activity.time}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-500">{activity.detail}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { accountingService } from "@/services/accounting.service";
import { useActiveCompany } from "@/providers/active-company-provider";

export function TaxPeriodSetup({ companyId }: { companyId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCompany } = useActiveCompany();
  const [commercialYear, setCommercialYear] = useState(2025);
  const [taxYear, setTaxYear] = useState(2026);
  const [startDate, setStartDate] = useState("2025-01-01");
  const [endDate, setEndDate] = useState("2025-12-31");
  const creation = useMutation({
    mutationFn: () =>
      accountingService.createPeriod(companyId, {
        commercialYear,
        taxYear,
        startDate,
        endDate,
      }),
    onSuccess: async (period) => {
      await queryClient.invalidateQueries({
        queryKey: ["tax-periods", companyId],
      });
      window.localStorage.setItem("jivatax.lastCompanyId", companyId);
      window.localStorage.setItem("jivatax.lastTaxPeriodId", period.id);
      router.replace(`/companies/${companyId}/periods/${period.id}/dashboard`);
    },
  });

  return (
    <main className="mx-auto max-w-3xl p-5 sm:p-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <CalendarPlus className="size-10 text-emerald-700" />
        <p className="mt-5 text-sm font-medium text-emerald-700">
          {activeCompany?.fantasyName ||
            activeCompany?.legalName ||
            "Empresa activa"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Esta empresa aún no tiene períodos tributarios
        </h1>
        <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
          <p>
            El <strong>año comercial</strong> es aquel en que ocurren las
            operaciones contables.
          </p>
          <p>
            El <strong>año tributario</strong> es aquel en que se presenta la
            declaración anual F22; normalmente es el año siguiente.
          </p>
        </div>
        <form
          className="mt-8 grid gap-5 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            creation.mutate();
          }}
        >
          <NumberField
            label="Año comercial"
            value={commercialYear}
            onChange={setCommercialYear}
          />
          <NumberField
            label="Año tributario"
            value={taxYear}
            onChange={setTaxYear}
          />
          <DateField
            label="Fecha inicial"
            value={startDate}
            onChange={setStartDate}
          />
          <DateField
            label="Fecha final"
            value={endDate}
            onChange={setEndDate}
          />
          {creation.isError && (
            <p className="sm:col-span-2 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              No fue posible crear el período. Verifica tus permisos y los datos
              ingresados.
            </p>
          )}
          <button
            type="submit"
            disabled={creation.isPending}
            className="inline-flex w-auto items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
          >
            {creation.isPending && (
              <LoaderCircle className="size-4 animate-spin" />
            )}
            Crear primer período tributario
          </button>
        </form>
      </section>
    </main>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      <input
        type="number"
        min={1900}
        max={2201}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        required
        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2 text-sm font-medium">
      <span>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-normal"
      />
    </label>
  );
}

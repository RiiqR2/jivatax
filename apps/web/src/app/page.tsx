"use client";

import { Building2, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { companyEntryPath } from "@/lib/accounting-navigation";
import { useActiveCompany } from "@/providers/active-company-provider";
import { accountingService } from "@/services/accounting.service";

export default function HomePage() {
  const router = useRouter();
  const { availableCompanies, loading } = useActiveCompany();

  useEffect(() => {
    if (loading || availableCompanies.length === 0) {
      return;
    }

    const rememberedId = window.localStorage.getItem("jivatax.lastCompanyId");
    const company =
      availableCompanies.find((item) => item.id === rememberedId) ??
      availableCompanies[0];

    void accountingService.periods(company.id).then((periods) => {
      router.replace(companyEntryPath(company.id, periods));
    });
  }, [availableCompanies, loading, router]);

  if (loading || availableCompanies.length > 0) {
    return (
      <main className="grid min-h-[calc(100vh-4rem)] place-items-center">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <LoaderCircle className="size-5 animate-spin text-emerald-700" />
          Preparando tu contexto operativo…
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-[calc(100vh-4rem)] place-items-center p-6">
      <section className="max-w-lg rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <Building2 className="mx-auto size-10 text-slate-400" />
        <h1 className="mt-4 text-2xl font-semibold">Sin empresas asociadas</h1>
        <p className="mt-2 text-slate-600">
          Solicita a un administrador que te incorpore a una empresa para
          comenzar a trabajar.
        </p>
      </section>
    </main>
  );
}

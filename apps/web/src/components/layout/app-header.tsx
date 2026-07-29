"use client";

import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  LoaderCircle,
  LogOut,
  Menu,
  ShieldCheck,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLogout } from "@/hooks/use-logout";
import { useSession } from "@/hooks/use-session";
import { useActiveCompany } from "@/providers/active-company-provider";
import { TaxPeriodSelector } from "@/components/accounting/tax-period-selector";

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const logout = useLogout();
  const session = useSession();
  const { activeCompany, availableCompanies, selectCompany, loading } =
    useActiveCompany();

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const chooseCompany = (companyId: string) => {
    selectCompany(companyId);
    setOpen(false);
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        type="button"
        className="rounded-lg p-2 text-slate-500 lg:hidden"
        aria-label="Abrir navegación"
      >
        <Menu className="size-5" />
      </button>
      <div className="ml-auto flex items-center gap-4" ref={menu}>
        {!isAdmin && activeCompany && (
          <TaxPeriodSelector companyId={activeCompany.id} />
        )}
        {isAdmin ? (
          <>
            <button
              type="button"
              onClick={() =>
                router.push(
                  activeCompany
                    ? `/companies/${activeCompany.id}/dashboard`
                    : "/companies",
                )
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="size-4" />
              Volver a la empresa
            </button>
            <div className="hidden items-center gap-2 text-sm font-semibold text-slate-800 sm:flex">
              <ShieldCheck className="size-5 text-emerald-700" />
              Administración global
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
              {loading ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Building2 className="size-4" />
              )}
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block max-w-56 truncate text-sm font-semibold text-slate-900">
                {activeCompany?.fantasyName ||
                  activeCompany?.legalName ||
                  "Seleccionar empresa"}
              </span>
              <span className="block text-xs text-slate-500">
                {activeCompany
                  ? `RUT ${activeCompany.rut}`
                  : "Sin empresa activa"}
              </span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-slate-400" />
          </button>
        )}
        {!isAdmin && open && (
          <div className="absolute right-4 top-14 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white py-2 shadow-xl sm:right-6">
            <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Empresas disponibles
            </p>
            <div className="max-h-72 overflow-y-auto">
              {availableCompanies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => chooseCompany(company.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <Building2 className="size-4 shrink-0 text-slate-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {company.fantasyName || company.legalName}
                    </span>
                    <span className="text-xs text-slate-500">
                      RUT {company.rut}
                    </span>
                  </span>
                  {activeCompany?.id === company.id && (
                    <Check className="size-4 text-emerald-700" />
                  )}
                </button>
              ))}
              {!loading && availableCompanies.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-500">
                  No tienes empresas asociadas.
                </p>
              )}
            </div>
            <div className="border-t border-slate-100 pt-2">
              {session.data?.user.platformRole === "metauser" && (
                <button
                  type="button"
                  onClick={() => {
                    router.push("/admin");
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50"
                >
                  <ShieldCheck className="size-4" />
                  Administración global
                </button>
              )}
              <button
                type="button"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-700 hover:bg-red-50"
              >
                <LogOut className="size-4" />
                Cerrar sesión
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

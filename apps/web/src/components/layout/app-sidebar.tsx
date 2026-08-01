"use client";

import {
  FileText,
  ListChecks,
  LayoutDashboard,
  LibraryBig,
  Leaf,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { useLogout } from "@/hooks/use-logout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActiveCompany } from "@/providers/active-company-provider";
import {
  accountingExplorerPath,
  isAccountingExplorerPath,
  isValidTaxPeriodId,
} from "@/lib/accounting-navigation";

export function AppSidebar() {
  const pathname = usePathname();
  const session = useSession();
  const logout = useLogout();
  const { activeCompany } = useActiveCompany();
  const companyId = activeCompany?.id;
  const taxPeriodId = pathname.match(/\/periods\/([^/]+)/)?.[1];
  const validTaxPeriodId = isValidTaxPeriodId(taxPeriodId) ? taxPeriodId : null;
  const operationalBase =
    companyId && validTaxPeriodId
      ? `/companies/${companyId}/periods/${validTaxPeriodId}`
      : null;
  const setupPath = companyId
    ? `/companies/${companyId}/periods/setup`
    : "/companies";
  const isAdmin = pathname.startsWith("/admin");
  const navigation =
    !isAdmin && companyId
      ? [
          {
            label: "Resumen",
            href: operationalBase ? `${operationalBase}/dashboard` : setupPath,
            icon: LayoutDashboard,
          },
          {
            label: "Documentos",
            href: operationalBase ? `${operationalBase}/documents` : setupPath,
            icon: FileText,
            title: operationalBase
              ? undefined
              : "Crea un período tributario para cargar documentos",
          },
          {
            label: "Homologación",
            href: operationalBase
              ? `${operationalBase}/account-mapping`
              : setupPath,
            icon: ListChecks,
            title: operationalBase
              ? undefined
              : "Selecciona un período tributario para homologar cuentas",
          },
          {
            label: "Explorador contable",
            href: validTaxPeriodId
              ? accountingExplorerPath(companyId, validTaxPeriodId)
              : setupPath,
            icon: LibraryBig,
            active: validTaxPeriodId
              ? isAccountingExplorerPath(pathname)
              : false,
            title: operationalBase
              ? undefined
              : "Selecciona un período tributario para explorar la contabilidad",
          },
          {
            label: "Usuarios",
            href: `/companies/${companyId}/users`,
            icon: Users,
          },
        ]
      : [];

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-800 bg-slate-950 text-slate-200 lg:flex lg:flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
        <span className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white">
          <Leaf className="size-5" />
        </span>
        <div>
          <p className="font-semibold tracking-tight text-white">JivaTax</p>
          <p className="text-[11px] text-slate-400">Gestión tributaria</p>
        </div>
      </div>
      <nav
        className="flex-1 overflow-y-auto p-3"
        aria-label="Navegación principal"
      >
        <div className="space-y-1">
          {navigation.map((item) => {
            const active =
              ("active" in item ? item.active : undefined) ??
              pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                title={item.title}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-slate-800 font-medium text-white"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          {session.data?.user.platformRole === "metauser" && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                pathname.startsWith("/admin")
                  ? "bg-slate-800 font-medium text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white",
              )}
            >
              <ShieldCheck className="size-4" />
              Administración
            </Link>
          )}
        </div>
      </nav>
      <footer className="shrink-0 border-t border-slate-800 p-3">
        <Button
          type="button"
          variant="ghost"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
          className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-900 hover:text-white"
        >
          {logout.isPending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          {logout.isPending ? "Cerrando sesión…" : "Cerrar sesión"}
        </Button>
      </footer>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mainNavigation, secondaryNavigation } from "@/config/navigation";
import { useLogout } from "@/hooks/use-logout";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const logout = useLogout();
  const session = useSession();
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-950 text-slate-200 lg:flex lg:flex-col">
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
        className="flex flex-1 flex-col justify-between p-3"
        aria-label="Navegación principal"
      >
        <div className="space-y-1">
          {mainNavigation.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-disabled={item.disabled}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-slate-800 font-medium text-white"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white",
                  item.disabled && "pointer-events-none opacity-50",
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          {session.data?.user.platformRole === "metauser" && (
            <Link
              href="/administration/users"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                pathname.startsWith("/administration")
                  ? "bg-slate-800 font-medium text-white"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white",
              )}
            >
              <ShieldCheck className="size-4" />
              Administración
            </Link>
          )}
        </div>
        <div className="space-y-1 border-t border-slate-800 pt-3">
          {secondaryNavigation.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              aria-disabled={item.disabled}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 opacity-50"
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
          <Button
            type="button"
            variant="ghost"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            className="mt-2 w-full justify-start gap-3 px-3 text-slate-300 hover:bg-slate-900 hover:text-white"
          >
            {logout.isPending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <LogOut className="size-4" aria-hidden="true" />
            )}
            <span>
              {logout.isPending ? "Cerrando sesión…" : "Cerrar sesión"}
            </span>
          </Button>
        </div>
      </nav>
    </aside>
  );
}

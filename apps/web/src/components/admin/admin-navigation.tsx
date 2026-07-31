"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { label: "Usuarios", href: "/admin/users" },
  { label: "Empresas", href: "/admin/companies" },
  { label: "Plan de cuentas SII", href: "/admin/sii-account-plan" },
  { label: "Resumen de homologación", href: "/admin/account-matching" },
];

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Secciones de administración"
      className="border-b border-slate-200 bg-white px-5 sm:px-8"
    >
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium transition",
                active
                  ? "border-emerald-700 text-emerald-800"
                  : "border-transparent text-slate-500 hover:text-slate-900",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

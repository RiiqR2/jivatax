"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  balancePath,
  buildBalanceExplorerParams,
  buildLedgerExplorerParams,
  formatAccountingAmount,
  ledgerPath,
} from "@/lib/accounting-explorer";
import { accountingService } from "@/services/accounting.service";

const input =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600";
function Pager({
  page,
  total,
  pageSize,
  setPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  setPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span>
        {total} resultados · Página {page} de {pages}
      </span>
      <div className="flex gap-2">
        <button
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className="rounded border p-2 disabled:opacity-40"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          aria-label="Página siguiente"
          disabled={page >= pages}
          onClick={() => setPage(page + 1)}
          className="rounded border p-2 disabled:opacity-40"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function BalanceExplorer({
  companyId,
  taxPeriodId,
}: {
  companyId: string;
  taxPeriodId: string;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState({
    code: "",
    name: "",
    mapping: "all",
    section: "",
    page: 1,
  });
  const query = useQuery({
    queryKey: ["explorer-balance", companyId, taxPeriodId, filters],
    queryFn: () =>
      accountingService.explorerBalance(
        companyId,
        taxPeriodId,
        buildBalanceExplorerParams(filters),
      ),
  });
  const change = (key: string, value: string) =>
    setFilters((old) => ({ ...old, [key]: value, page: 1 }));
  const hasFilters = Boolean(
    filters.code ||
    filters.name ||
    filters.mapping !== "all" ||
    filters.section,
  );
  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <nav className="mb-3 text-sm text-slate-500">
        <Link
          href={`/companies/${companyId}/periods/${taxPeriodId}/dashboard`}
          className="hover:text-emerald-700"
        >
          Período tributario
        </Link>{" "}
        <span className="mx-2">/</span>{" "}
        <span className="text-slate-900">Balance</span>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold text-slate-950">Balance</h1>
        <p className="mt-1 text-sm text-slate-600">
          Explora las cuentas y accede a sus movimientos en el Libro Mayor.
        </p>
      </header>
      <section
        aria-label="Filtros de Balance"
        className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-5"
      >
        <input
          aria-label="Buscar por código"
          placeholder="Código cuenta"
          value={filters.code}
          onChange={(e) => change("code", e.target.value)}
          className={input}
        />
        <input
          aria-label="Buscar por nombre"
          placeholder="Nombre cuenta"
          value={filters.name}
          onChange={(e) => change("name", e.target.value)}
          className={input}
        />
        <select
          aria-label="Estado de homologación"
          value={filters.mapping}
          onChange={(e) => change("mapping", e.target.value)}
          className={input}
        >
          <option value="all">Todas</option>
          <option value="mapped">Solo homologadas</option>
          <option value="pending">Solo pendientes</option>
        </select>
        <select
          aria-label="Sección contable"
          value={filters.section}
          onChange={(e) => change("section", e.target.value)}
          className={input}
        >
          <option value="">Todas las secciones</option>
          <option value="asset">Activo</option>
          <option value="liability">Pasivo</option>
          <option value="loss">Pérdidas</option>
          <option value="gain">Ganancias</option>
        </select>
      </section>
      {query.data?.total === 0 && !hasFilters ? (
        <section className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Aún no hay un Balance disponible
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            Importa y procesa un Balance válido para comenzar a explorar las
            cuentas de este período.
          </p>
          <Link
            href={`/companies/${companyId}/periods/${taxPeriodId}/documents`}
            className="mt-5 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Ir a Documentos
          </Link>
        </section>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  {[
                    "Código cuenta",
                    "Nombre cuenta",
                    "Código SII",
                    "Nombre cuenta SII",
                    "Débitos",
                    "Créditos",
                    "Saldo Deudor",
                    "Saldo Acreedor",
                  ].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {query.data?.items.map((row) => (
                  <tr
                    key={row.accountId}
                    tabIndex={0}
                    role="link"
                    onClick={() =>
                      router.push(
                        ledgerPath(companyId, taxPeriodId, row.accountId),
                      )
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        router.push(
                          ledgerPath(companyId, taxPeriodId, row.accountId),
                        );
                    }}
                    className="cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50"
                  >
                    <td className="px-4 py-3 font-medium text-emerald-800">
                      {row.code}
                    </td>
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">{row.siiCode ?? "Pendiente"}</td>
                    <td className="px-4 py-3">{row.siiName ?? "—"}</td>
                    {[
                      row.debit,
                      row.credit,
                      row.debitBalance,
                      row.creditBalance,
                    ].map((v, i) => (
                      <td key={i} className="px-4 py-3 text-right tabular-nums">
                        {formatAccountingAmount(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.isLoading && (
            <p className="p-6 text-center text-slate-500">Cargando Balance…</p>
          )}
          {query.isError && (
            <p className="p-6 text-center text-red-700">
              No fue posible cargar el Balance.
            </p>
          )}
          {query.data && (
            <Pager
              page={filters.page}
              pageSize={query.data.pageSize}
              total={query.data.total}
              setPage={(page) => setFilters((old) => ({ ...old, page }))}
            />
          )}
        </div>
      )}
    </main>
  );
}

export function GeneralLedgerExplorer({
  companyId,
  taxPeriodId,
  accountId,
}: {
  companyId: string;
  taxPeriodId: string;
  accountId: string;
}) {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    documentType: "",
    documentNumber: "",
    search: searchParams.get("search") ?? "",
    sort: "date",
    direction: "asc",
    page: 1,
  });
  const query = useQuery({
    queryKey: ["explorer-ledger", companyId, taxPeriodId, accountId, filters],
    queryFn: () =>
      accountingService.explorerLedger(
        companyId,
        taxPeriodId,
        accountId,
        buildLedgerExplorerParams(filters),
      ),
  });
  const change = (key: string, value: string) =>
    setFilters((old) => ({ ...old, [key]: value, page: 1 }));
  const sort = (column: string) =>
    setFilters((old) => ({
      ...old,
      sort: column,
      direction:
        old.sort === column && old.direction === "asc" ? "desc" : "asc",
      page: 1,
    }));
  const hasFilters = Boolean(
    filters.from ||
    filters.to ||
    filters.documentType ||
    filters.documentNumber ||
    filters.search,
  );
  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <nav className="mb-3 text-sm text-slate-500">
        <Link
          href={balancePath(companyId, taxPeriodId)}
          className="hover:text-emerald-700"
        >
          Balance
        </Link>
        <span className="mx-2">/</span>
        <span>{query.data?.account.code ?? "Cuenta"}</span>
        <span className="mx-2">/</span>
        <span className="text-slate-900">Libro Mayor</span>
      </nav>
      <Link
        href={balancePath(companyId, taxPeriodId)}
        className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800"
      >
        <ArrowLeft className="size-4" /> Volver al Balance
      </Link>
      <header className="mt-4">
        <h1 className="text-2xl font-semibold">Libro Mayor</h1>
        <p className="mt-1 text-slate-600">
          <strong>{query.data?.account.code}</strong> ·{" "}
          {query.data?.account.name}
        </p>
      </header>
      <section
        aria-label="Filtros de Libro Mayor"
        className="mt-6 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-5"
      >
        <input
          aria-label="Fecha desde"
          type="date"
          value={filters.from}
          onChange={(e) => change("from", e.target.value)}
          className={input}
        />
        <input
          aria-label="Fecha hasta"
          type="date"
          value={filters.to}
          onChange={(e) => change("to", e.target.value)}
          className={input}
        />
        <input
          aria-label="Tipo documento"
          placeholder="Tipo documento"
          value={filters.documentType}
          onChange={(e) => change("documentType", e.target.value)}
          className={input}
        />
        <input
          aria-label="Número documento"
          placeholder="Número documento"
          value={filters.documentNumber}
          onChange={(e) => change("documentNumber", e.target.value)}
          className={input}
        />
        <input
          aria-label="Buscar glosa"
          placeholder="Buscar glosa"
          value={filters.search}
          onChange={(e) => change("search", e.target.value)}
          className={input}
        />
      </section>
      {query.data?.total === 0 && !hasFilters ? (
        <section className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            No hay movimientos de Libro Mayor
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            No existen movimientos procesados para esta cuenta en el período
            seleccionado. Puedes cargar el Libro Mayor desde Documentos.
          </p>
          <Link
            href={`/companies/${companyId}/periods/${taxPeriodId}/documents`}
            className="mt-5 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Ir a Documentos
          </Link>
        </section>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  {[
                    ["Fecha", "date"],
                    ["Tipo documento", "documentType"],
                    ["Número documento", "documentNumber"],
                    ["Glosa", "description"],
                    ["Debe", "debit"],
                    ["Haber", "credit"],
                    ["Saldo acumulado", "runningBalance"],
                  ].map(([label, key]) => (
                    <th key={key} className="whitespace-nowrap px-4 py-3">
                      <button onClick={() => sort(key)}>
                        {label}
                        {filters.sort === key
                          ? filters.direction === "asc"
                            ? " ↑"
                            : " ↓"
                          : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {query.data?.items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.transactionDate}
                    </td>
                    <td className="px-4 py-3">{row.documentType ?? "—"}</td>
                    <td className="px-4 py-3">{row.documentNumber ?? "—"}</td>
                    <td className="px-4 py-3">{row.description}</td>
                    {[row.debit, row.credit, row.runningBalance].map((v, i) => (
                      <td key={i} className="px-4 py-3 text-right tabular-nums">
                        {formatAccountingAmount(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.isLoading && (
            <p className="p-6 text-center text-slate-500">
              Cargando movimientos…
            </p>
          )}
          {query.isError && (
            <p className="p-6 text-center text-red-700">
              No fue posible cargar el Libro Mayor.
            </p>
          )}
          {query.data && (
            <Pager
              page={filters.page}
              pageSize={query.data.pageSize}
              total={query.data.total}
              setPage={(page) => setFilters((old) => ({ ...old, page }))}
            />
          )}
        </div>
      )}
    </main>
  );
}

"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  buildBalanceExplorerParams,
  buildLedgerExplorerParams,
  formatAccountingAmount,
  ledgerPath,
  safeBalanceReturnTo,
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
const statusLabels = {
  reconciled: "Conciliado",
  difference: "Con diferencia",
  no_ledger: "Sin movimientos",
  unavailable: "No disponible",
};
const statusClasses = {
  reconciled: "bg-emerald-100 text-emerald-800",
  difference: "bg-red-100 text-red-800",
  no_ledger: "bg-amber-100 text-amber-800",
  unavailable: "bg-slate-100 text-slate-700",
};

export function BalanceExplorer({
  companyId,
  taxPeriodId,
}: {
  companyId: string;
  taxPeriodId: string;
}) {
  const router = useRouter(),
    pathname = usePathname(),
    searchParams = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    search: searchParams.get("search") ?? "",
    section: searchParams.get("section") ?? "",
    reconciliation: searchParams.get("reconciliation") ?? "all",
    sort: searchParams.get("sort") ?? "code",
    direction: searchParams.get("direction") ?? "asc",
    page: Number(searchParams.get("page") ?? 1),
    balanceDocumentId: searchParams.get("balanceDocumentId") ?? undefined,
  }));
  const [mode, setMode] = useState<"balance" | "reconciliation">("balance");
  const [openingDetailOpen, setOpeningDetailOpen] = useState(false);
  const [openingStatus, setOpeningStatus] = useState("");
  useEffect(() => {
    const params = new URLSearchParams();
    const api = buildBalanceExplorerParams(filters);
    for (const [key, value] of Object.entries(api)) {
      if (key !== "pageSize" && value !== "" && value !== "all")
        params.set(key, String(value));
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [filters, pathname, router]);
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
  const open = (accountId: string) =>
    router.push(
      ledgerPath(
        companyId,
        taxPeriodId,
        accountId,
        `${pathname}${window.location.search}`,
      ),
    );
  const data = query.data;
  const openingDetail = useQuery({
    queryKey: ["opening-control", companyId, taxPeriodId, openingStatus],
    queryFn: () =>
      accountingService.openingControl(companyId, taxPeriodId, {
        page: 1,
        pageSize: 25,
        sort: "code",
        direction: "asc",
        ...(openingStatus ? { status: openingStatus } : {}),
      }),
    enabled: openingDetailOpen,
  });
  const ledgerAvailable = Boolean(data?.sources.generalLedgerDocument);
  const amount = (label: string, value: string, count?: number) => (
    <div>
      <dt className="text-xs text-slate-500">
        {label}
        {count === undefined ? "" : ` · ${count} cuentas`}
      </dt>
      <dd className="mt-1 font-medium tabular-nums">
        {formatAccountingAmount(value)}
      </dd>
    </div>
  );
  return (
    <main className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
      <nav className="mb-3 text-sm text-slate-500">
        <Link
          href={`/companies/${companyId}/periods/${taxPeriodId}/dashboard`}
          className="hover:text-emerald-700"
        >
          Período tributario
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-900">Balance</span>
      </nav>
      <header>
        <h1 className="text-2xl font-semibold text-slate-950">
          Explorador contable · Balance
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {data?.sources.companyName || "Empresa"} · Año comercial{" "}
          {data?.sources.commercialYear ?? "—"} · Año tributario{" "}
          {data?.sources.taxYear ?? "—"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {data?.sources.openingBalanceDocument
            ? `Balance inicial v${data.sources.openingBalanceDocument.versionNumber}`
            : "Balance inicial no disponible"}{" "}
          ·{" "}
          {data?.sources.closingBalanceDocument
            ? `Balance final v${data.sources.closingBalanceDocument.versionNumber}`
            : "Balance final no disponible"}{" "}
          · Libro Mayor{" "}
          {data?.sources.generalLedgerDocument
            ? `v${data.sources.generalLedgerDocument.versionNumber}`
            : "no disponible"}
        </p>
      </header>
      {data?.balanceAvailable && (
        <section
          aria-label="Navegación del explorador"
          className="mt-5 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              aria-pressed={mode === "balance"}
              onClick={() => setMode("balance")}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === "balance" ? "bg-emerald-700 text-white" : "border"}`}
            >
              Balance
            </button>
            <button
              type="button"
              disabled={!ledgerAvailable}
              aria-pressed={mode === "reconciliation"}
              onClick={() => setMode("reconciliation")}
              className="rounded-lg border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
            >
              Conciliación con Libro Mayor
            </button>
            {!ledgerAvailable && (
              <p className="text-sm text-slate-600">
                Carga un Libro Mayor para habilitar la conciliación de
                movimientos.
              </p>
            )}
            {!ledgerAvailable && (
              <Link
                className="text-sm font-medium text-emerald-800 underline"
                href={`/companies/${companyId}/periods/${taxPeriodId}/documents`}
              >
                Cargar Libro Mayor
              </Link>
            )}
          </div>
        </section>
      )}
      {data?.balanceAvailable && mode === "balance" && (
        <section
          aria-labelledby="balance-summary-title"
          className="mt-5 rounded-xl border border-slate-200 bg-white p-4"
        >
          <h2
            id="balance-summary-title"
            className="font-semibold text-slate-950"
          >
            Resumen del Balance
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {data.summary.totalAccounts} cuentas en la importación seleccionada
          </p>
          <div className="mt-4 grid gap-5 lg:grid-cols-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Movimiento acumulado
              </h3>
              <dl className="grid gap-2">
                {amount("Débitos", data.summary.totalBalanceDebits)}
                {amount("Créditos", data.summary.totalBalanceCredits)}
                {amount("Diferencia", data.summary.debitCreditDifference)}
              </dl>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Saldos</h3>
              <dl className="grid gap-2">
                {amount("Saldo deudor", data.summary.totalBalanceDebitBalance)}
                {amount(
                  "Saldo acreedor",
                  data.summary.totalBalanceCreditBalance,
                )}
                {amount(
                  "Diferencia",
                  data.summary.debitCreditBalanceDifference,
                )}
              </dl>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Clasificación</h3>
              <dl className="grid grid-cols-2 gap-2">
                {amount(
                  "Activo",
                  data.summary.totalBalanceAssets,
                  data.summary.assetAccountCount,
                )}
                {amount(
                  "Pasivo",
                  data.summary.totalBalanceLiabilities,
                  data.summary.liabilityAccountCount,
                )}
                {amount(
                  "Pérdidas",
                  data.summary.totalBalanceLosses,
                  data.summary.lossAccountCount,
                )}
                {amount(
                  "Ganancias",
                  data.summary.totalBalanceGains,
                  data.summary.gainAccountCount,
                )}
              </dl>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">
                Control de cuadratura
              </h3>
              <dl className="grid gap-2">
                {amount(
                  "Activo + Pérdidas",
                  data.summary.accountingEquationLeft,
                )}
                {amount(
                  "Pasivo + Ganancias",
                  data.summary.accountingEquationRight,
                )}
                {amount(
                  "Diferencia",
                  data.summary.accountingEquationDifference,
                )}
                <div className="text-sm font-semibold">
                  Estado:{" "}
                  {data.summary.accountingEquationBalanced
                    ? "Cuadrado"
                    : "Con diferencia"}
                </div>
              </dl>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-emerald-50 p-3">
            <h3 className="text-sm font-semibold">
              Resultado contable según columnas del Balance
            </h3>
            <p className="mt-1 tabular-nums">
              {data.summary.netResultType === "profit"
                ? "Ganancia neta"
                : data.summary.netResultType === "loss"
                  ? "Pérdida neta"
                  : "Resultado cero"}
              : {formatAccountingAmount(data.summary.netResultAmount)}
            </p>
          </div>
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium">
              Totales informados por la empresa
            </summary>
            <p className="mt-2 text-slate-600">
              No se detectaron filas de totales informados en esta versión.
            </p>
          </details>
        </section>
      )}
      {data && (
        <section
          aria-label="Control de apertura"
          className="mt-5 rounded-xl border border-slate-200 bg-white p-4"
        >
          <h2 className="font-semibold">Control de apertura</h2>
          {!data.openingControl.previousClosingAvailable ? (
            <p className="mt-2 text-sm text-slate-600">
              No existe un Balance final anterior disponible para comparación.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-600">
                {data.openingControl.matchingAccounts} cuentas coincidentes ·{" "}
                {data.openingControl.accountsWithDifferences} con diferencias ·{" "}
                {data.openingControl.onlyInOpening} solo en apertura ·{" "}
                {data.openingControl.onlyInPreviousClosing} solo en cierre
                anterior
              </p>
              {data.openingControl.warning && (
                <p
                  role="status"
                  className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
                >
                  {data.openingControl.warning}
                </p>
              )}
              <button
                type="button"
                onClick={() => setOpeningDetailOpen((open) => !open)}
                className="mt-3 rounded-lg border px-3 py-2 text-sm font-medium"
              >
                {openingDetailOpen
                  ? "Ocultar diferencias"
                  : "Revisar diferencias"}
              </button>
              {openingDetailOpen && (
                <div className="mt-3 overflow-x-auto">
                  <label className="text-sm">
                    Estado{" "}
                    <select
                      value={openingStatus}
                      onChange={(event) => setOpeningStatus(event.target.value)}
                      className={input}
                    >
                      <option value="">Todos</option>
                      <option value="difference">Con diferencias</option>
                      <option value="only_in_opening">Solo en apertura</option>
                      <option value="only_in_previous_closing">
                        Solo en cierre anterior
                      </option>
                      <option value="matching">Coincidentes</option>
                    </select>
                  </label>
                  {openingDetail.isLoading ? (
                    <p className="mt-3 text-sm">Cargando detalle…</p>
                  ) : (
                    <table className="mt-3 min-w-[900px] text-sm">
                      <thead>
                        <tr>
                          {[
                            "Código",
                            "Nombre apertura",
                            "Nombre cierre anterior",
                            "Diferencia deudora",
                            "Diferencia acreedora",
                            "Estado",
                          ].map((heading) => (
                            <th key={heading} className="px-2 py-2 text-left">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {openingDetail.data?.items.map((item, index) => (
                          <tr key={`${item.code}-${index}`}>
                            <td className="px-2 py-2">{item.code}</td>
                            <td className="px-2 py-2">
                              {item.openingName ?? "—"}
                            </td>
                            <td className="px-2 py-2">
                              {item.previousClosingName ?? "—"}
                            </td>
                            <td className="px-2 py-2 text-right">
                              {formatAccountingAmount(item.debitDifference)}
                            </td>
                            <td className="px-2 py-2 text-right">
                              {formatAccountingAmount(item.creditDifference)}
                            </td>
                            <td className="px-2 py-2">{item.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      )}
      <section
        aria-label="Filtros de Balance"
        className="mt-5 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-3"
      >
        <input
          aria-label="Buscar por código o nombre"
          placeholder="Código o nombre"
          value={filters.search}
          onChange={(e) => change("search", e.target.value)}
          className={input}
        />
        <select
          aria-label="Sección contable"
          value={filters.section}
          onChange={(e) => change("section", e.target.value)}
          className={input}
        >
          <option value="">Todas las secciones</option>
          <option value="asset">Activo</option>
          <option value="liability">Pasivo</option>
          <option value="loss">Pérdida</option>
          <option value="gain">Ganancia</option>
        </select>
        {mode === "reconciliation" && (
          <select
            aria-label="Estado de conciliación"
            value={filters.reconciliation}
            onChange={(e) => change("reconciliation", e.target.value)}
            className={input}
          >
            <option value="all">Toda conciliación</option>
            <option value="reconciled">Conciliadas</option>
            <option value="difference">Con diferencias</option>
            <option value="no_ledger">Sin movimientos</option>
            <option value="unavailable">No disponible</option>
          </select>
        )}
        <select
          aria-label="Ordenar Balance"
          value={filters.sort}
          onChange={(e) => change("sort", e.target.value)}
          className={input}
        >
          <option value="code">Código</option>
          <option value="name">Nombre</option>
          <option value="debit">Débito Balance</option>
          <option value="credit">Crédito Balance</option>
          {mode === "reconciliation" && (
            <option value="difference">Diferencia absoluta</option>
          )}
          {mode === "reconciliation" && (
            <option value="movements">Movimientos</option>
          )}
          {mode === "reconciliation" && (
            <option value="lastMovement">Último movimiento</option>
          )}
        </select>
      </section>
      {data && !data.balanceAvailable ? (
        <section className="mt-4 rounded-xl border border-dashed bg-white p-10 text-center">
          <h2 className="text-lg font-semibold">
            Aún no hay un Balance disponible
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            El Balance procesado vigente es necesario para iniciar el
            explorador.
          </p>
          <Link
            href={`/companies/${companyId}/periods/${taxPeriodId}/documents`}
            className="mt-5 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Ir a Documentos
          </Link>
        </section>
      ) : (
        <div className="mt-4 rounded-xl border bg-white">
          <div className="max-h-[65vh] overflow-x-auto overflow-y-auto">
            <table
              className={
                mode === "balance"
                  ? "min-w-[1500px] table-fixed text-left text-sm"
                  : "min-w-[1250px] table-fixed text-left text-sm"
              }
            >
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th colSpan={2} className="px-3 py-2 text-center">
                    Cuenta
                  </th>
                  <th
                    colSpan={mode === "balance" ? 8 : 6}
                    className="px-3 py-2 text-center"
                  >
                    Balance final
                  </th>
                </tr>
                <tr>
                  {(mode === "balance"
                    ? [
                        "Código",
                        "Nombre",
                        "Débitos",
                        "Créditos",
                        "Saldo deudor",
                        "Saldo acreedor",
                        "Activo",
                        "Pasivo",
                        "Pérdidas",
                        "Ganancias",
                      ]
                    : [
                        "Código",
                        "Nombre",
                        "Débitos Balance",
                        "Debe Mayor",
                        "Diferencia debe",
                        "Créditos Balance",
                        "Haber Mayor",
                        "Diferencia haber",
                        "Movimientos",
                        "Estado",
                      ]
                  ).map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.items.map((row) => (
                  <tr
                    key={row.accountId}
                    tabIndex={0}
                    role="link"
                    aria-label={`Ver movimientos de ${row.code} ${row.name}`}
                    onClick={() =>
                      mode === "reconciliation" && open(row.accountId)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        open(row.accountId);
                      }
                    }}
                    className={
                      mode === "reconciliation"
                        ? "cursor-pointer hover:bg-emerald-50 focus:bg-emerald-50"
                        : "hover:bg-slate-50"
                    }
                  >
                    <td className="w-[130px] px-3 py-3 align-top font-medium text-slate-900">
                      {row.code}
                    </td>
                    <td
                      className="w-[290px] px-3 py-3 align-top"
                      title={row.name}
                    >
                      <span className="line-clamp-2 whitespace-normal [overflow-wrap:anywhere]">
                        {row.name}
                      </span>
                    </td>
                    {(mode === "balance"
                      ? [
                          row.balanceDebits,
                          row.balanceCredits,
                          row.balanceDebitBalance,
                          row.balanceCreditBalance,
                          row.balanceAssets,
                          row.balanceLiabilities,
                          row.balanceLosses,
                          row.balanceGains,
                        ]
                      : [
                          row.balanceDebits,
                          row.ledgerDebit,
                          row.debitDifference,
                          row.balanceCredits,
                          row.ledgerCredit,
                          row.creditDifference,
                        ]
                    ).map((v, i) => (
                      <td
                        key={i}
                        className="min-w-36 whitespace-nowrap px-3 py-3 text-right tabular-nums"
                      >
                        {formatAccountingAmount(v)}
                      </td>
                    ))}
                    {mode === "reconciliation" && (
                      <td className="px-3 py-3 text-right">
                        <strong>{row.ledgerMovementCount}</strong>
                      </td>
                    )}
                    {mode === "reconciliation" && (
                      <td className="px-3 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${statusClasses[row.reconciliationStatus]}`}
                        >
                          {statusLabels[row.reconciliationStatus]}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {query.isLoading && (
            <p className="p-6 text-center">Cargando Balance…</p>
          )}
          {query.isError && (
            <p className="p-6 text-center text-red-700">
              No fue posible cargar el Balance.
            </p>
          )}
          {data && (
            <Pager
              page={filters.page}
              pageSize={data.pageSize}
              total={data.total}
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
  const returnTo = safeBalanceReturnTo(
    searchParams.get("returnTo"),
    companyId,
    taxPeriodId,
  );
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
        <Link href={returnTo} className="hover:text-emerald-700">
          Balance
        </Link>
        <span className="mx-2">/</span>
        <span>{query.data?.account.code ?? "Cuenta"}</span>
        <span className="mx-2">/</span>
        <span className="text-slate-900">Libro Mayor</span>
      </nav>
      <Link
        href={returnTo}
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
            {query.data.generalLedgerAvailable
              ? "No hay movimientos para esta cuenta"
              : "No existe Libro Mayor procesado"}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600">
            {query.data.generalLedgerAvailable
              ? "El Libro Mayor vigente no contiene movimientos asociados a esta cuenta."
              : "La cuenta puede investigarse cuando exista una importación utilizable del Libro Mayor para este período."}
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

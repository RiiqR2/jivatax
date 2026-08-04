import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildBalanceExplorerParams,
  formatAccountingAmount,
  ledgerPath,
  safeBalanceReturnTo,
} from "../src/lib/accounting-explorer.ts";

const source = readFileSync(
  new URL(
    "../src/components/accounting/accounting-explorer.tsx",
    import.meta.url,
  ),
  "utf8",
);
const balanceSource = source.slice(
  0,
  source.indexOf("export function GeneralLedgerExplorer"),
);

test("balance filters omit empty optional values and mapping", () => {
  assert.deepEqual(
    buildBalanceExplorerParams({
      search: " ",
      section: "",
      reconciliation: "all",
      sort: "difference",
      direction: "desc",
      page: 2,
    }),
    { page: 2, pageSize: 25, sort: "difference", direction: "desc" },
  );
});

test("ledger navigation preserves a safe balance return URL", () => {
  const balance = "/companies/c/periods/p/balance?page=2&search=iva";
  assert.match(ledgerPath("c", "p", "a", balance), /returnTo=/);
  assert.equal(safeBalanceReturnTo(balance, "c", "p"), balance);
  assert.equal(
    safeBalanceReturnTo("https://evil.test", "c", "p"),
    "/companies/c/periods/p/balance",
  );
});

test("null accounting totals remain unavailable", () => {
  assert.equal(formatAccountingAmount(null), "—");
});

test("explorer uses one compact reconciliation panel without mapping UI", () => {
  assert.equal(
    (
      source.match(/<h2[^>]*>[\s\S]*?Estado de conciliación[\s\S]*?<\/h2>/g) ??
      []
    ).length,
    1,
  );
  for (const removed of [
    "Homologadas",
    "Pendientes",
    "Homologación SII",
    "Estado de homologación",
    "Revisar homologación",
  ])
    assert.doesNotMatch(source, new RegExp(removed));
  assert.match(source, /Libro Mayor no disponible/);
  assert.match(source, /!ledgerAvailable \?/);
});

test("balance table exposes every accounting column with horizontal scrolling", () => {
  for (const column of [
    "Código",
    "Nombre",
    "Débitos",
    "Créditos",
    "Saldo deudor",
    "Saldo acreedor",
    "Debe",
    "Haber",
    "Diferencia debe",
    "Diferencia haber",
    "Movimientos",
    "Último movimiento",
    "Estado",
  ])
    assert.match(source, new RegExp(`"${column}"`));
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /min-w-\[1700px\]/);
  assert.match(source, /colSpan=\{4\}/);
  assert.doesNotMatch(
    balanceSource,
    /overflow-hidden rounded-xl border bg-white/,
  );
});

test("rows preserve accessible investigation and explicit reconciliation labels", () => {
  for (const label of ["Conciliado", "Sin movimientos", "No disponible"])
    assert.match(source, new RegExp(label));
  assert.match(source, /role="link"/);
  assert.match(source, /onKeyDown/);
  assert.match(source, /e\.key === " "/);
  assert.doesNotMatch(source, />\s*Ver movimientos/);
  assert.match(source, /formatAccountingDate/);
});

test("opening detail is lazy, filterable, and the header uses only explicit sources", () => {
  assert.match(source, /enabled: openingDetailOpen/);
  assert.match(source, /accountingService\.openingControl/);
  assert.match(source, /setOpeningStatus/);
  assert.match(source, /Revisar diferencias/);
  assert.match(source, /openingBalanceDocument/);
  assert.match(source, /closingBalanceDocument/);
  assert.doesNotMatch(source, /sources\.balanceDocument/);
});

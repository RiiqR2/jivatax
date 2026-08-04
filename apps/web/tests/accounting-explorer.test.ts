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

test("balance and reconciliation are separated without mapping UI", () => {
  assert.match(source, /Conciliación con Libro Mayor/);
  assert.match(source, /disabled=\{!ledgerAvailable\}/);
  assert.match(
    source,
    /Carga un Libro Mayor para habilitar la conciliación de\s+movimientos/,
  );
  assert.doesNotMatch(balanceSource, /accountMappings|period-account-mappings/);
});

test("balance table exposes exactly the eight financial amounts in balance mode", () => {
  for (const field of [
    "balanceDebits",
    "balanceCredits",
    "balanceDebitBalance",
    "balanceCreditBalance",
    "balanceAssets",
    "balanceLiabilities",
    "balanceLosses",
    "balanceGains",
  ])
    assert.match(balanceSource, new RegExp(`row\.${field}`));
  assert.match(source, /overflow-x-auto/);
  assert.match(source, /min-w-\[1500px\]/);
  assert.doesNotMatch(balanceSource, /sticky left|left-\[|z-20/);
  assert.match(balanceSource, /line-clamp-2 whitespace-normal/);
});

test("precision-safe es-CL formatting does not convert large decimals to Number", () => {
  assert.equal(
    formatAccountingAmount("2054528310788.0000"),
    "2.054.528.310.788",
  );
  assert.equal(formatAccountingAmount("1765760604.1200"), "1.765.760.604,12");
});

test("historical document id participates in balance request parameters", () => {
  const params = buildBalanceExplorerParams({
    search: "",
    section: "",
    reconciliation: "all",
    sort: "code",
    direction: "asc",
    page: 1,
    balanceDocumentId: "version-5",
  });
  assert.equal(params.balanceDocumentId, "version-5");
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

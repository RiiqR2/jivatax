import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildBalanceExplorerParams,
  ledgerPath,
  safeBalanceReturnTo,
} from "../src/lib/accounting-explorer.ts";

test("balance filters omit empty optional values", () => {
  assert.deepEqual(
    buildBalanceExplorerParams({
      search: " ",
      mapping: "all",
      section: "",
      reconciliation: "all",
      sort: "difference",
      direction: "desc",
      page: 2,
    }),
    {
      mapping: "all",
      page: 2,
      pageSize: 25,
      sort: "difference",
      direction: "desc",
    },
  );
});

test("ledger navigation preserves a safe balance return URL", () => {
  const balance = "/companies/c/periods/p/balance?page=2&search=iva";
  const ledger = ledgerPath("c", "p", "a", balance);
  assert.match(ledger, /returnTo=/);
  assert.equal(safeBalanceReturnTo(balance, "c", "p"), balance);
  assert.equal(
    safeBalanceReturnTo("https://evil.test", "c", "p"),
    "/companies/c/periods/p/balance",
  );
});

test("explorer renders summaries, reconciliation states and accessible investigation controls", () => {
  const source = readFileSync(
    new URL(
      "../src/components/accounting/accounting-explorer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  for (const text of [
    "Total cuentas",
    "Conciliadas",
    "Con diferencias",
    "Sin movimientos",
    "No existe un Libro Mayor procesado",
    "Aún no hay un Balance disponible",
    "Ir a Documentos",
    "Revisar homologación",
    "Ver movimientos",
  ])
    assert.match(source, new RegExp(text));
  assert.match(source, /role="link"/);
  assert.match(source, /onKeyDown/);
  assert.match(source, /stopPropagation/);
});

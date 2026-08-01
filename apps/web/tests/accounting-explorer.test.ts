import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  balancePath,
  formatAccountingAmount,
  ledgerPath,
} from "../src/lib/accounting-explorer.ts";

test("builds the Balance to Libro Mayor navigation preserving company and period", () => {
  assert.equal(
    balancePath("company-1", "period-1"),
    "/companies/company-1/periods/period-1/balance",
  );
  assert.equal(
    ledgerPath("company-1", "period-1", "account-1"),
    "/companies/company-1/periods/period-1/balance/accounts/account-1/general-ledger",
  );
});

test("formats accounting values for presentation", () => {
  assert.match(formatAccountingAmount("1234"), /1[.\s]234/);
});

test("expone accesos contextuales y estados vacíos accionables", () => {
  const explorer = readFileSync(
    new URL(
      "../src/components/accounting/accounting-explorer.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const documents = readFileSync(
    new URL("../src/components/accounting/documents-page.tsx", import.meta.url),
    "utf8",
  );
  const mappings = readFileSync(
    new URL(
      "../src/components/accounting/account-mapping-page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(explorer, /Aún no hay un Balance disponible/);
  assert.match(explorer, /No hay movimientos de Libro Mayor/);
  assert.match(explorer, /Ir a Documentos/);
  assert.match(documents, /explorerDocumentPath/);
  assert.match(documents, /Ver en explorador contable/);
  assert.match(mappings, /Ver Balance/);
});

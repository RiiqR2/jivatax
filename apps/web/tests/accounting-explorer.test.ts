import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  balancePath,
  buildBalanceExplorerParams,
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

test("omite filtros vacíos y conserva parámetros obligatorios del Balance", () => {
  assert.deepEqual(
    buildBalanceExplorerParams({
      code: " ",
      name: "",
      mapping: "all",
      section: "",
      page: 1,
    }),
    { mapping: "all", page: 1, pageSize: 25 },
  );
  assert.deepEqual(
    buildBalanceExplorerParams({
      code: " 1101 ",
      name: " Caja ",
      mapping: "mapped",
      section: "asset",
      page: 2,
    }),
    {
      mapping: "mapped",
      page: 2,
      pageSize: 25,
      code: "1101",
      name: "Caja",
      section: "asset",
    },
  );
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

test("la ruta sin período muestra configuración sin montar el explorador", () => {
  const page = readFileSync(
    new URL(
      "../src/app/companies/[companyId]/periods/[taxPeriodId]/balance/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(page, /isValidTaxPeriodId/);
  assert.match(page, /Crear período tributario/);
  assert.match(page, /periods\/setup/);
  assert.ok(
    page.indexOf("if (!isValidTaxPeriodId") < page.indexOf("<BalanceExplorer"),
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  accumulatedBalance,
  AccountingExplorerService,
} from "./accounting-explorer.service";

type QueryFixture = {
  sources: Array<Record<string, unknown>>;
  items: Array<Record<string, unknown>>;
  summary: Record<string, unknown>;
};

function serviceWithFixture(fixture: QueryFixture) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes("FROM tax_documents d")) return fixture.sources;
      if (sql.includes("COUNT(*) totalAccounts")) return [fixture.summary];
      if (sql.includes("SELECT explorer.*")) return fixture.items;
      if (sql.includes("FROM company_accounts"))
        return [{ id: "account-1", code: "1101", name: "Caja" }];
      if (sql.includes("FROM (SELECT e.id")) return [];
      throw new Error(`Consulta inesperada: ${sql}`);
    },
  };
  const service = new AccountingExplorerService(
    db as never,
    {
      get: async () => ({ commercialYear: 2025, taxYear: 2026 }),
    } as never,
  );
  return { service, calls };
}

const query = {
  page: 1,
  pageSize: 25,
  mapping: "all",
  sort: "code",
  direction: "asc",
};
const balanceSource = {
  id: "balance-v2",
  importId: null,
  documentType: "balance",
  versionNumber: 2,
  processedAt: "2026-01-01",
  companyName: "Empresa",
};
const ledgerSource = {
  id: "ledger-v3",
  importId: "ledger-import-v3",
  documentType: "general_ledger",
  versionNumber: 3,
  processedAt: "2026-01-02",
  companyName: "Empresa",
};

test("calculates a chronological accumulated balance", () => {
  assert.deepEqual(
    accumulatedBalance([
      { debit: 100, credit: 0 },
      { debit: 0, credit: 35 },
      { debit: 10, credit: 2 },
    ]),
    [100, 65, 73],
  );
});

test("a processed ledger document without an import is unavailable everywhere", async () => {
  const { service, calls } = serviceWithFixture({
    sources: [balanceSource, { ...ledgerSource, importId: null }],
    items: [
      {
        accountId: "account-1",
        ledgerDebit: null,
        ledgerCredit: null,
        debitDifference: null,
        creditDifference: null,
        reconciliationStatus: "unavailable",
        total: "1",
      },
    ],
    // Protect the response even if a driver/database returns inconsistent counts.
    summary: {
      totalAccounts: "1",
      reconciledAccounts: "15",
      accountsWithDifferences: "2",
      accountsWithoutLedgerMovements: "1",
      totalLedgerDebit: "0.0000",
    },
  });
  const result = await service.balance("company", "period", query);
  assert.equal(result.sources.generalLedgerDocument, null);
  assert.equal(result.summary.reconciliationUnavailable, true);
  assert.equal(result.summary.reconciledAccounts, 0);
  assert.equal(result.summary.accountsWithDifferences, 0);
  assert.equal(result.summary.accountsWithoutLedgerMovements, 0);
  assert.equal(result.summary.totalLedgerDebit, null);
  assert.equal(result.items[0].reconciliationStatus, "unavailable");
  assert.equal(result.items[0].ledgerDebit, null);
  assert.match(calls[0].sql, /LEFT JOIN general_ledger_imports gli/);
});

test("an imported ledger without movements classifies balance accounts as no_ledger", async () => {
  const { service } = serviceWithFixture({
    sources: [balanceSource, ledgerSource],
    items: [
      {
        accountId: "account-1",
        ledgerDebit: "0.0000",
        ledgerCredit: "0.0000",
        ledgerMovementCount: 0,
        reconciliationStatus: "no_ledger",
        total: "1",
      },
    ],
    summary: {
      totalAccounts: "1",
      reconciledAccounts: "0",
      accountsWithDifferences: "0",
      accountsWithoutLedgerMovements: "1",
      reconciliationUnavailable: 0,
      totalLedgerDebit: "0.0000",
      totalLedgerCredit: "0.0000",
    },
  });
  const result = await service.balance("company", "period", query);
  assert.equal(result.summary.reconciliationUnavailable, 0);
  assert.equal(result.summary.reconciledAccounts, "0");
  assert.equal(result.items[0].reconciliationStatus, "no_ledger");
  assert.equal(result.sources.generalLedgerDocument?.versionNumber, 3);
});

test("an imported ledger reports reconciled accounts and differences from the same source", async () => {
  const { service, calls } = serviceWithFixture({
    sources: [balanceSource, ledgerSource],
    items: [
      { accountId: "a", reconciliationStatus: "reconciled", total: "2" },
      { accountId: "b", reconciliationStatus: "difference", total: "2" },
    ],
    summary: {
      totalAccounts: "2",
      reconciledAccounts: "1",
      accountsWithDifferences: "1",
      accountsWithoutLedgerMovements: "0",
      reconciliationUnavailable: 0,
      totalLedgerDebit: "90.0000",
      totalLedgerCredit: "80.0000",
      totalDebitDifference: "10.0000",
      totalCreditDifference: "20.0000",
    },
  });
  const result = await service.balance("company", "period", query);
  assert.equal(result.summary.reconciledAccounts, "1");
  assert.equal(result.summary.accountsWithDifferences, "1");
  const pageQuery = calls.find((call) =>
    call.sql.includes("SELECT explorer.*"),
  )!;
  assert.match(pageQuery.sql, /e\.general_ledger_import_id=\?/);
  assert.equal(pageQuery.params[0], "ledger-import-v3");
});

test("source resolution chooses only the latest processed, non-discarded document", async () => {
  const { service, calls } = serviceWithFixture({
    sources: [balanceSource],
    items: [],
    summary: { totalAccounts: "0" },
  });
  await service.balance("company", "period", query);
  assert.match(calls[0].sql, /d\.status='processed'/);
  assert.match(calls[0].sql, /d\.discarded_at IS NULL/);
  assert.match(calls[0].sql, /MAX\(current\.version_number\)/);
  assert.match(calls[0].sql, /current\.status='processed'/);
});

test("ledger detail reuses the resolved import and keeps the chronological window", async () => {
  const { service, calls } = serviceWithFixture({
    sources: [balanceSource, ledgerSource],
    items: [],
    summary: {},
  });
  const result = await service.generalLedger("company", "period", "account-1", {
    page: 1,
    pageSize: 25,
    search: "factura",
    sort: "date",
    direction: "asc",
  });
  assert.equal(result.total, 0);
  const ledgerQuery = calls.find((call) =>
    call.sql.includes("FROM (SELECT e.id"),
  )!;
  assert.match(ledgerQuery.sql, /e\.general_ledger_import_id = \?/);
  assert.match(ledgerQuery.sql, /SUM\(filtered\.debit - filtered\.credit\)/);
  assert.equal(ledgerQuery.params[3], "ledger-import-v3");
});

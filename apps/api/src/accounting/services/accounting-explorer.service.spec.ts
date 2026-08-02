import assert from "node:assert/strict";
import test from "node:test";
import {
  accumulatedBalance,
  AccountingExplorerService,
} from "./accounting-explorer.service";

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

test("balance endpoint applies filters and pagination", async () => {
  let captured: { sql: string; params: unknown[] } | undefined;
  let call = 0;
  const db = {
    query: async (sql: string, params: unknown[]) => {
      call += 1;
      if (call === 1)
        return [
          {
            id: "balance-document",
            documentType: "balance",
            versionNumber: 2,
            processedAt: "2026-01-01",
            companyName: "Empresa",
          },
          {
            id: "ledger-document",
            documentType: "general_ledger",
            versionNumber: 1,
            processedAt: "2026-01-02",
            companyName: "Empresa",
          },
        ];
      if (call === 2) captured = { sql, params };
      return call === 2
        ? [{ accountId: "a", total: "12", reconciliationStatus: "reconciled" }]
        : [{ totalAccounts: "12" }];
    },
  };
  const periods = {
    get: async () => ({ id: "p", commercialYear: 2025, taxYear: 2026 }),
  };
  const service = new AccountingExplorerService(db as never, periods as never);
  const result = await service.balance("c", "p", {
    page: 2,
    pageSize: 5,
    code: "110",
    name: "caja",
    mapping: "mapped",
    section: "asset",
    sort: "code",
    direction: "asc",
  });
  assert.equal(result.total, 12);
  assert.match(captured!.sql, /m\.status = 'confirmed'/);
  assert.match(captured!.sql, /asset_amount <> 0/);
  assert.deepEqual(captured!.params.slice(-2), [5, 5]);
});

test("balance distinguishes an unavailable ledger without turning null totals into zero", async () => {
  let call = 0;
  const db = {
    query: async () => {
      call += 1;
      if (call === 1)
        return [{ id: "b", documentType: "balance", versionNumber: 3 }];
      if (call === 2)
        return [
          {
            accountId: "a",
            ledgerDebit: null,
            ledgerCredit: null,
            reconciliationStatus: "unavailable",
            total: "1",
          },
        ];
      return [{ totalAccounts: "1", reconciliationUnavailable: 1 }];
    },
  };
  const service = new AccountingExplorerService(
    db as never,
    { get: async () => ({ commercialYear: 2025, taxYear: 2026 }) } as never,
  );
  const result = await service.balance("c", "p", {
    page: 1,
    pageSize: 25,
    mapping: "all",
    sort: "code",
    direction: "asc",
  });
  assert.equal(result.items[0].reconciliationStatus, "unavailable");
  assert.equal(result.items[0].ledgerDebit, null);
  assert.equal(result.sources.generalLedgerDocument, null);
});

test("ledger endpoint pages filtered movements and uses a chronological window", async () => {
  const calls: string[] = [];
  const db = {
    query: async (sql: string) => {
      calls.push(sql);
      return calls.length === 1
        ? [{ id: "a", code: "1101", name: "Caja" }]
        : [{ id: "m", total: 1, runningBalance: "20" }];
    },
  };
  const service = new AccountingExplorerService(
    db as never,
    { get: async () => ({}) } as never,
  );
  const result = await service.generalLedger("c", "p", "a", {
    page: 1,
    pageSize: 25,
    search: "factura",
    sort: "date",
    direction: "asc",
  });
  assert.equal(result.total, 1);
  assert.match(
    calls[1],
    /SUM\(filtered\.debit - filtered\.credit\) OVER \(ORDER BY filtered\.transactionDate/,
  );
  assert.match(calls[1], /e\.description LIKE/);
  assert.match(calls[1], /LIMIT \? OFFSET \?/);
});

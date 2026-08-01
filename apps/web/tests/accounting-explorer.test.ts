import assert from "node:assert/strict";
import test from "node:test";
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

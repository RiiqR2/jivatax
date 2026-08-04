import assert from "node:assert/strict";
import test from "node:test";
import { AddBalanceRole1785040000000 } from "./1785040000000-add-balance-role";

test("rollback detects version collisions before changing the schema", async () => {
  const calls: string[] = [];
  const runner = {
    query: async (sql: string) => {
      calls.push(sql);
      if (sql.includes("HAVING COUNT(*) > 1")) return [{ total: 2 }];
      throw new Error("schema must not be modified");
    },
  };
  await assert.rejects(
    new AddBalanceRole1785040000000().down(runner as never),
    /No se puede revertir balance_role/,
  );
  assert.equal(calls.length, 1);
});

test("rollback restores the previous index only when there are no collisions", async () => {
  const calls: string[] = [];
  const runner = {
    query: async (sql: string) => {
      calls.push(sql);
      return [];
    },
  };
  await new AddBalanceRole1785040000000().down(runner as never);
  assert.equal(calls.length, 3);
  assert.match(calls[2], /ADD UNIQUE KEY uq_tax_documents_version/);
});

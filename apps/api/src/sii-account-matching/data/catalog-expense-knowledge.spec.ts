import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { resolveCatalogExpenseKnowledge } from "./catalog-expense-knowledge";

const account = (id: string, code: string, name: string) =>
  ({ id, code, name, deletedAt: null }) as SiiAccountEntity;

describe("catalogue-resolved expense knowledge", () => {
  it("uses the code and id loaded from the selected catalogue version", () => {
    const expense = account(
      "runtime-id",
      "runtime-code",
      "Gastos de administración y ventas",
    );
    const result = resolveCatalogExpenseKnowledge([
      expense,
      account("prepaid", "1.01.11.00", "Gastos pagados por anticipado"),
      account("retained", "runtime-equity", "Pérdidas acumuladas"),
    ]);

    assert.equal(result.destinations.length, 3);
    assert.ok(
      result.destinations.every(
        (destination) =>
          destination.code === expense.code &&
          destination.name === expense.name,
      ),
    );
    const aliases =
      result.terms.get(expense.id)?.map((term) => term.term) ?? [];
    assert.ok(aliases.includes("arriendo"));
    assert.ok(aliases.includes("gastos de honorarios"));
    assert.ok(aliases.includes("electricidad"));
    assert.equal(result.terms.has("prepaid"), false);
    assert.equal(result.terms.has("retained"), false);
  });

  it("prefers a specific real expense destination when the catalogue has one", () => {
    const generic = account(
      "generic",
      "generic-code",
      "Gastos de administración y ventas",
    );
    const electricity = account(
      "electricity",
      "electricity-code",
      "Electricidad y servicios básicos",
    );
    const result = resolveCatalogExpenseKnowledge([generic, electricity]);

    assert.ok(
      result.terms
        .get(electricity.id)
        ?.some((term) => term.term === "electricidad"),
    );
    assert.equal(
      result.terms
        .get(generic.id)
        ?.some((term) => term.term === "electricidad") ?? false,
      false,
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { AccountCandidateGeneratorService } from "./account-candidate-generator.service";
import { AccountSuggestionRankingService } from "./account-suggestion-ranking.service";
import { CatalogReferenceResolverService } from "./catalog-reference-resolver.service";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";

const account = (id: string, code: string, name: string) =>
  ({ id, code, name, deletedAt: null }) as SiiAccountEntity;

const context = (
  section: "asset" | "liability" | "expense" | "income",
  nature: "debit" | "credit",
) => ({
  assetAmount: section === "asset" ? "100" : "0",
  liabilityAmount: section === "liability" ? "100" : "0",
  lossAmount: section === "expense" ? "100" : "0",
  gainAmount: section === "income" ? "100" : "0",
  debitBalance: nature === "debit" ? "100" : "0",
  creditBalance: nature === "credit" ? "100" : "0",
});

describe("basic homologation precision", () => {
  const generator = new AccountCandidateGeneratorService();
  const ranking = new AccountSuggestionRankingService();

  const basicCatalog = () => [
    account("cash", "1.01.01.00", "Disponible"),
    account("donations", "2.02.15.00", "Créditos por Donaciones"),
    account("inventory-transit", "1.01.25.00", "Existencias en Tránsito"),
    account("payments-transit", "1.01.12.00", "Pagos en tránsito"),
    account("prepaid-suppliers", "1.01.08.00", "Anticipo a proveedores"),
    account("iva", "1.01.59.00", "IVA Crédito Fiscal"),
    account("deferred-expense", "1.01.15.00", "Gastos Diferidos"),
  ];

  const rankFirst = (
    observedAccountName: string,
    accounts: SiiAccountEntity[],
    balance = context("asset", "debit"),
  ) => {
    const generated = generator.generate(accounts, []);
    return ranking.rank({ observedAccountName }, generated, balance);
  };

  it("maps Caja to Disponible as the first candidate", () => {
    const result = rankFirst("Caja", basicCatalog());
    assert.equal(result.candidates[0]?.account.code, "1.01.01.00");
    assert.ok(
      result.candidates[0]?.reasons.some((reason) =>
        reason.signal.startsWith("exact_"),
      ),
    );
  });

  it("maps Banco de Crédito e Inversiones to Disponible", () => {
    const result = rankFirst("Banco de Crédito e Inversiones", basicCatalog());
    assert.equal(result.candidates[0]?.account.code, "1.01.01.00");
    assert.equal(
      result.candidates.some(
        (candidate) => candidate.account.code === "2.02.15.00",
      ),
      false,
    );
  });

  it("does not map Banco de Crédito e Inversiones Ingresos to Créditos por Donaciones", () => {
    const result = rankFirst(
      "Banco de Crédito e Inversiones Ingresos",
      basicCatalog(),
      context("asset", "debit"),
    );
    assert.notEqual(result.candidates[0]?.account.code, "2.02.15.00");
    assert.equal(result.candidates[0]?.account.code, "1.01.01.00");
  });

  it("does not map Banco de Crédito e Inversiones Egresos to Créditos por Donaciones", () => {
    const result = rankFirst(
      "Banco de Crédito e Inversiones Egresos",
      basicCatalog(),
      context("asset", "debit"),
    );
    assert.notEqual(result.candidates[0]?.account.code, "2.02.15.00");
    assert.equal(result.candidates[0]?.account.code, "1.01.01.00");
  });

  it("does not map Pagos en tránsito TRM to Existencias en Tránsito", () => {
    const result = rankFirst("Pagos en tránsito TRM", basicCatalog());
    assert.notEqual(result.candidates[0]?.account.code, "1.01.25.00");
    assert.equal(result.candidates[0]?.account.code, "1.01.12.00");
  });

  it("prioritizes Anticipo Proveedores toward Anticipo a proveedores", () => {
    const result = rankFirst("Anticipo Proveedores", basicCatalog());
    assert.equal(result.candidates[0]?.account.code, "1.01.08.00");
  });

  it("prioritizes IVA Crédito Fiscal toward its official destination", () => {
    const result = rankFirst("IVA Crédito Fiscal", basicCatalog());
    assert.equal(result.candidates[0]?.account.code, "1.01.59.00");
    assert.ok(
      result.candidates[0]?.reasons.some(
        (reason) =>
          reason.signal === "exact_official_name" ||
          reason.signal === "exact_alias",
      ),
    );
  });

  it("keeps Honorarios Diferidos near Gastos Diferidos", () => {
    const result = rankFirst(
      "Honorarios Diferidos",
      basicCatalog(),
      context("asset", "debit"),
    );
    assert.ok(
      result.candidates.some(
        (candidate) => candidate.account.code === "1.01.15.00",
      ),
    );
    assert.equal(result.candidates[0]?.account.code, "1.01.15.00");
  });

  it("detects orphan SII references explicitly during resolution", async () => {
    const resolver = new CatalogReferenceResolverService({
      getRepository: () => ({
        find: async () => [{ id: "stale-id", code: "1.01.01.00" }],
      }),
    } as never);
    const current = [account("cash", "1.01.01.00", "Disponible")];
    const staleTerm = {
      siiAccountId: "stale-id",
      normalizedTerm: "caja",
      term: "caja",
      type: "alias",
      active: true,
      deletedAt: null,
    } as SiiAccountTermEntity;
    const resolved = await resolver.resolve({
      terms: [staleTerm],
      concepts: [],
      knowledge: [],
      learning: [],
      currentAccounts: current,
    });
    assert.equal(resolved.remappedCount, 1);
    assert.equal(resolved.terms[0]?.siiAccountId, "cash");
    assert.equal(resolved.orphans.length, 0);

    const unresolved = await resolver.resolve({
      terms: [{ ...staleTerm, siiAccountId: "missing-id" }],
      concepts: [],
      knowledge: [],
      learning: [],
      currentAccounts: current,
    });
    assert.equal(unresolved.terms.length, 0);
    assert.equal(unresolved.orphans.length, 1);
    assert.equal(unresolved.orphans[0]?.siiAccountId, "missing-id");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { AccountCandidateGeneratorService } from "./account-candidate-generator.service";
import { AccountSuggestionRankingService } from "./account-suggestion-ranking.service";

const account = (id: string, code: string, name: string) =>
  ({ id, code, name, deletedAt: null }) as SiiAccountEntity;

const context = (
  section: "asset" | "liability" | "expense" | "income" | "equity",
  nature: "debit" | "credit",
) => ({
  assetAmount: section === "asset" ? "100" : "0",
  liabilityAmount: section === "liability" ? "100" : "0",
  lossAmount: section === "expense" ? "100" : "0",
  gainAmount: section === "income" ? "100" : "0",
  debitBalance: nature === "debit" ? "100" : "0",
  creditBalance: nature === "credit" ? "100" : "0",
});

describe("semantic homologation precision", () => {
  const generator = new AccountCandidateGeneratorService();
  const ranking = new AccountSuggestionRankingService();

  const semanticCatalog = () => [
    account("prepaid", "1.01.11.00", "Gastos pagados por anticipado"),
    account(
      "admin-expense",
      "3.01.03.00",
      "Gastos de administración y ventas (menos)",
    ),
    account("bad-debt", "1.01.05.00", "Provisión de deuda incobrable (menos)"),
    account("payables-provision", "2.01.08.00", "Provisión gastos por pagar"),
    account("payments-transit", "1.01.12.00", "Pagos en tránsito"),
    account("inventory-transit", "1.01.25.00", "Existencias en Tránsito"),
    account("stock-comp", "2.03.05.00", "Pagos basados en acciones"),
    account(
      "related-nc",
      "1.02.01.00",
      "Préstamos por cobrar empresas relacionadas NC",
    ),
    account("current-receivable", "1.01.05.00", "Deudores por venta"),
    account("lease-deferred", "1.01.15.00", "Intereses diferidos leasing"),
    account(
      "loan-interest-nc",
      "1.02.02.00",
      "Intereses préstamos por cobrar NC",
    ),
    account("retained-gain", "2.03.02.00", "Utilidades acumuladas"),
    account("retained-loss", "2.03.03.00", "Pérdidas acumuladas"),
    account("cash", "1.01.01.00", "Disponible"),
  ];

  const rankFirst = (
    observedAccountName: string,
    accounts: SiiAccountEntity[],
    balance = context("asset", "debit"),
  ) =>
    ranking.rank(
      { observedAccountName },
      generator.generate(accounts, []),
      balance,
    );

  it("maps Seguros Anticipados to prepaid assets", () => {
    const result = rankFirst("Seguros Anticipados", semanticCatalog());
    assert.equal(result.candidates[0]?.account.code, "1.01.11.00");
  });

  it("maps Comisiones Anticipadas to prepaid assets", () => {
    const result = rankFirst("Comisiones Anticipadas", semanticCatalog());
    assert.equal(result.candidates[0]?.account.code, "1.01.11.00");
  });

  it("does not map Pagos en tránsito TRM to Pagos Basados en Acciones", () => {
    const result = rankFirst("Pagos en tránsito TRM", semanticCatalog());
    assert.notEqual(result.candidates[0]?.account.code, "2.03.05.00");
    assert.equal(result.candidates[0]?.account.code, "1.01.12.00");
  });

  it("does not map Provisión Deuda Incobrable to Provisión Gastos por Pagar", () => {
    const result = rankFirst(
      "Provisión Deuda Incobrable",
      semanticCatalog(),
      context("asset", "credit"),
    );
    assert.notEqual(result.candidates[0]?.account.code, "2.01.08.00");
    assert.equal(result.candidates[0]?.account.code, "1.01.05.00");
  });

  it("does not map Préstamo por cobrar relacionado NC to generic current receivable", () => {
    const result = rankFirst(
      "Préstamos por cobrar relacionados no corrientes",
      semanticCatalog(),
      context("asset", "debit"),
    );
    assert.notEqual(result.candidates[0]?.account.code, "1.01.05.00");
    assert.equal(result.candidates[0]?.account.code, "1.02.01.00");
  });

  it("does not map Intereses préstamos por cobrar NC to intereses diferidos leasing", () => {
    const result = rankFirst(
      "Intereses préstamos por cobrar NC",
      semanticCatalog(),
      context("asset", "debit"),
    );
    assert.notEqual(result.candidates[0]?.account.code, "1.01.15.00");
    assert.equal(result.candidates[0]?.account.code, "1.02.02.00");
  });

  it("maps Resultado Acumulado toward retained earnings family", () => {
    const result = rankFirst(
      "Resultado Acumulado",
      semanticCatalog(),
      context("equity", "credit"),
    );
    assert.ok(
      ["2.03.02.00", "2.03.03.00"].includes(
        result.candidates[0]?.account.code ?? "",
      ),
    );
  });

  it("maps Arriendo Fijo toward compatible expense accounts", () => {
    const result = rankFirst(
      "Arriendo Fijo",
      semanticCatalog(),
      context("expense", "debit"),
    );
    assert.equal(result.candidates[0]?.account.code, "3.01.03.00");
  });

  it("leaves Pagos en tránsito TRM without suggestion when only incompatible destinations exist", () => {
    const result = rankFirst("Pagos en tránsito TRM", [
      account("inventory-transit", "1.01.25.00", "Existencias en Tránsito"),
      account("stock-comp", "2.03.05.00", "Pagos basados en acciones"),
    ]);
    assert.equal(result.decision, "no_candidate");
    assert.equal(result.candidates.length, 0);
  });
});

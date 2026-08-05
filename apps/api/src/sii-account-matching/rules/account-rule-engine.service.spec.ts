import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { GeneratedCandidate } from "../account-matching.types";
import type { SiiAccountKnowledgeEntity } from "../entities/sii-account-knowledge.entity";
import { accountingMetadata } from "../metadata/accounting-metadata";
import { AccountRuleEngineService } from "./account-rule-engine.service";

const candidate = (
  name: string,
  section: SiiAccountKnowledgeEntity["statementSection"],
  taxType: SiiAccountKnowledgeEntity["taxType"] = "none",
): GeneratedCandidate => ({
  account: { id: name, code: name, name, deletedAt: null } as SiiAccountEntity,
  metadata: { ...accountingMetadata(name), statementSection: section },
  terms: [],
  concepts: [],
  knowledge: {
    accountingFamily: "taxes",
    statementSection: section,
    balanceNature: section === "asset" ? "debit" : "credit",
    taxType,
    financialType: "none",
    isControlAccount: false,
    isContraAccount: false,
    isCurrent: true,
    isResidual: false,
    attributes: null,
    active: true,
  } as SiiAccountKnowledgeEntity,
  negativeTerms: [],
});

describe("AccountRuleEngineService", () => {
  const engine = new AccountRuleEngineService();
  it("excludes an expense destination for sales with an auditable rule", () => {
    const result = engine.evaluate(
      "Ventas afectas",
      accountingMetadata("Ventas afectas"),
      "income",
      candidate("Gastos", "expense"),
    );
    assert.equal(result.excluded, true);
    assert.equal(result.signals[0]?.ruleId, "sales_never_expense");
  });
  it("scores a PPM asset only when structured tax metadata agrees", () => {
    const result = engine.evaluate(
      "PPM",
      accountingMetadata("PPM"),
      "asset",
      candidate("Impuestos por recuperar", "asset", "ppm"),
    );
    assert.ok(result.signals.some((signal) => signal.points === 45));
  });
  it("forces partner current accounts to review", () => {
    const result = engine.evaluate(
      "CTA CTE SOCIO 1",
      accountingMetadata("CTA CTE SOCIO 1"),
      "asset",
      candidate("Cuentas por cobrar", "asset"),
    );
    assert.equal(result.review, true);
  });
});

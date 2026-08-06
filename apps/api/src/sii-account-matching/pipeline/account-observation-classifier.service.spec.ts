import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { AccountObservationClassifierService } from "./account-observation-classifier.service";
import { decimalValueState } from "./decimal-value";

const classifier = new AccountObservationClassifierService();
const observe = (
  accountName: string,
  values: Record<string, string | null> = {},
) => classifier.classify({ accountCode: "test", accountName, ...values });

describe("AccountObservationClassifierService balance context", () => {
  for (const [field, section] of [
    ["assetAmount", "asset"],
    ["liabilityAmount", "liability"],
    ["lossAmount", "expense"],
    ["gainAmount", "income"],
  ] as const)
    test(`${field} is primary evidence for ${section}`, () =>
      assert.equal(
        observe("Cuenta ambigua", { [field]: "1.0000" }).observedSection,
        section,
      ));

  test("arriendo follows its Balance result column", () => {
    assert.equal(
      observe("Arriendo", { gainAmount: "5" }).observedSection,
      "income",
    );
    assert.equal(
      observe("Arriendo", { lossAmount: "5" }).observedSection,
      "expense",
    );
  });

  for (const [name, field, section, family] of [
    ["Anticipo Clientes", "liabilityAmount", "liability", "customer_advance"],
    ["Préstamo por cobrar", "assetAmount", "asset", "loan_receivable"],
    ["Préstamo por pagar", "liabilityAmount", "liability", "loan_payable"],
    [
      "Pasivos por arrendamientos",
      "liabilityAmount",
      "liability",
      "lease_liability",
    ],
  ] as const)
    test(`${name} respects context`, () => {
      const result = observe(name, { [field]: "10" });
      assert.equal(result.observedSection, section);
      assert.equal(result.accountFamily, family);
    });

  test("bad debt write-off is an expense, while its allowance is contra asset", () => {
    assert.equal(
      observe("Deuda incobrable", { lossAmount: "1" }).observedSection,
      "expense",
    );
    const allowance = observe("Provisión deuda incobrable", {
      assetAmount: "1",
    });
    assert.equal(allowance.observedSection, "contra_asset");
    assert.equal(allowance.balanceNature, "credit");
  });

  test("accumulated depreciation remains a credit contra asset", () => {
    const result = observe("Depreciación acumulada", { assetAmount: "1" });
    assert.equal(result.observedSection, "contra_asset");
    assert.equal(result.balanceNature, "credit");
  });

  test("explicit equity metadata survives a liability presentation block", () =>
    assert.equal(
      observe("Resultado acumulado", { liabilityAmount: "1" }).observedSection,
      "equity",
    ));

  test("VAT families retain their accounting section and nature", () => {
    const credit = observe("IVA Crédito Fiscal");
    assert.deepEqual(
      [credit.observedSection, credit.balanceNature],
      ["asset", "debit"],
    );
    const debit = observe("IVA Débito Fiscal");
    assert.deepEqual(
      [debit.observedSection, debit.balanceNature],
      ["liability", "credit"],
    );
  });

  test("opposite balance natures are not resolved arbitrarily", () => {
    const result = observe("Cuenta ambigua", {
      debitBalance: "1",
      creditBalance: "2",
    });
    assert.equal(result.balanceNature, "unknown");
    assert.ok(
      result.classificationWarnings.some((warning) =>
        warning.startsWith("contradictory_balance_natures"),
      ),
    );
  });

  test("incompatible positive sections remain unknown and traceable", () => {
    const result = observe("Cuenta ambigua", {
      assetAmount: "1",
      liabilityAmount: "1",
    });
    assert.equal(result.observedSection, "unknown");
    assert.ok(
      result.classificationWarnings.some((warning) =>
        warning.startsWith("contradictory_balance_sections"),
      ),
    );
    assert.equal(result.classificationEvidence.length, 2);
  });

  test("insufficient evidence remains unknown", () => {
    const result = observe("Cuenta auxiliar genérica");
    assert.deepEqual(
      [result.observedSection, result.balanceNature],
      ["unknown", "unknown"],
    );
  });

  test("DECIMAL values are inspected without precision loss", () => {
    assert.equal(decimalValueState("99999999999999999999.9999"), "positive");
    assert.equal(
      observe("Cuenta", { assetAmount: "99999999999999999999.9999" })
        .observedSection,
      "asset",
    );
  });

  test("null, empty and decimal zero are not positive", () => {
    const result = observe("Cuenta", {
      assetAmount: null,
      liabilityAmount: "",
      gainAmount: "0.0000",
    });
    assert.equal(result.observedSection, "unknown");
    assert.equal(decimalValueState("-0.0000"), "zero");
  });
});

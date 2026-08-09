import assert from "node:assert/strict";
import { test } from "node:test";
import { CalculationInput } from "../contracts/tax-work-paper-calculator";
import { WorkPaperInputSourceType } from "../tax-work-paper.enums";
import { A17_INPUT, A17V1Calculator } from "./a17-v1.calculator";

const evidence = [
  {
    type: "fixture",
    sourceEntityType: "auxiliary",
    sourceEntityId: "00000000-0000-4000-8000-000000000001",
  },
];
const values: Record<string, string> = {
  [A17_INPUT.LIABILITY_OPENING]: "1000.1000",
  [A17_INPUT.LIABILITY_CLOSING]: "1280.3500",
  [A17_INPUT.DEFERRED_OPENING]: "120.0000",
  [A17_INPUT.DEFERRED_CLOSING]: "90.0000",
  [A17_INPUT.NEW_CONTRACTS]: "500.2500",
  [A17_INPUT.PAYMENTS]: "300.0000",
  [A17_INPUT.MONETARY_CORRECTION]: "50.0000",
  [A17_INPUT.REMEASUREMENTS]: "25.0000",
  [A17_INPUT.DEFERRED_AMORTIZATION]: "30.0000",
  [A17_INPUT.OTHER_MOVEMENTS]: "5.0000",
};
const inputs = (
  overrides: Record<string, string | undefined> = {},
): CalculationInput[] =>
  Object.entries({ ...values, ...overrides })
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([inputKey, valueSnapshot]) => ({
      inputKey,
      valueSnapshot,
      sourceType: WorkPaperInputSourceType.AUXILIARY,
      evidence,
    }));
const calculate = (provided = inputs()) =>
  new A17V1Calculator().calculate({
    companyId: "company",
    taxPeriodId: "period",
    executionId: "execution",
    definitionCode: "A.17",
    definitionVersion: 1,
    inputs: provided,
  });

test("A.17@1 calcula ambos roll-forwards con decimal exacto y concilia", async () => {
  const result = await calculate();
  assert.deepEqual(
    result.reconciliations.map((item) => [
      item.key,
      item.calculatedAmount,
      item.status,
    ]),
    [
      ["LEASE_LIABILITY", "1280.3500", "ok"],
      ["DEFERRED_LEASE_INTEREST", "90.0000", "ok"],
    ],
  );
  assert.equal(result.missingInputs.length, 0);
  assert.equal(result.taxAdjustments.length, 5);
  assert.ok(
    result.taxAdjustments.every(
      (adjustment) =>
        adjustment.amount !== "0.0000" && adjustment.evidence?.length,
    ),
  );
});
test("A.17@1 expone diferencias sin ocultarlas", async () => {
  const result = await calculate(
    inputs({ [A17_INPUT.LIABILITY_CLOSING]: "1280.3400" }),
  );
  assert.equal(result.reconciliations[0].difference, "0.0100");
  assert.equal(result.reconciliations[0].status, "warning");
  assert.equal(result.warnings.length, 1);
});
test("A.17@1 informa faltantes y no inventa conciliación ni ajuste", async () => {
  const result = await calculate(
    inputs({
      [A17_INPUT.PAYMENTS]: undefined,
      [A17_INPUT.DEFERRED_CLOSING]: undefined,
    }),
  );
  assert.ok(result.missingInputs.includes(A17_INPUT.PAYMENTS));
  assert.ok(result.missingInputs.includes(A17_INPUT.DEFERRED_CLOSING));
  assert.equal(result.reconciliations.length, 0);
  assert.ok(
    !result.taxAdjustments.some(
      (item) => item.ruleKey === "A17_RLI_LEASE_PAYMENTS",
    ),
  );
  assert.ok(
    !result.taxAdjustments.some(
      (item) => item.ruleKey === "A17_CPT_DEFERRED_INTEREST",
    ),
  );
});
test("A.17@1 exige evidencia para proponer ajustes", async () => {
  assert.equal(
    (await calculate(inputs().map((input) => ({ ...input, evidence: [] }))))
      .taxAdjustments.length,
    0,
  );
});
test("la implementación monetaria no convierte a Number y conserva subunidades", async () => {
  const result = await calculate(
    inputs({
      [A17_INPUT.LIABILITY_OPENING]: "9007199254740992.0001",
      [A17_INPUT.LIABILITY_CLOSING]: "9007199254741272.2501",
    }),
  );
  assert.equal(
    result.reconciliations[0].calculatedAmount,
    "9007199254741272.2501",
  );
  assert.equal(result.reconciliations[0].status, "ok");
});

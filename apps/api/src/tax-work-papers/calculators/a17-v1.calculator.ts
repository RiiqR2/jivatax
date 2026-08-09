import {
  CalculationContext,
  CalculationEvidence,
  CalculationInput,
  CalculationResult,
  CalculationTaxAdjustment,
  ReconciliationResult,
  TaxWorkPaperCalculator,
} from "../contracts/tax-work-paper-calculator";
import {
  TaxAdjustmentType,
  TaxDifferenceNature,
} from "../tax-work-paper.enums";
import { FixedDecimal } from "./fixed-decimal";

export const A17_INPUT = {
  LIABILITY_OPENING: "LEASE_LIABILITY_OPENING",
  LIABILITY_CLOSING: "LEASE_LIABILITY_CLOSING",
  DEFERRED_OPENING: "DEFERRED_INTEREST_OPENING",
  DEFERRED_CLOSING: "DEFERRED_INTEREST_CLOSING",
  NEW_CONTRACTS: "NEW_LEASE_CONTRACTS",
  PAYMENTS: "LEASE_PAYMENTS",
  MONETARY_CORRECTION: "LEASE_MONETARY_CORRECTION",
  REMEASUREMENTS: "LEASE_REMEASUREMENTS",
  DEFERRED_AMORTIZATION: "DEFERRED_INTEREST_AMORTIZATION",
  OTHER_MOVEMENTS: "OTHER_LEASE_MOVEMENTS",
} as const;

const REQUIRED = Object.values(A17_INPUT);

export class A17V1Calculator implements TaxWorkPaperCalculator {
  readonly definitionCode = "A.17";
  readonly definitionVersion = 1;

  async calculate(context: CalculationContext): Promise<CalculationResult> {
    const byKey = new Map(
      context.inputs.map((input) => [input.inputKey, input]),
    );
    const missingInputs = REQUIRED.filter(
      (key) => !byKey.get(key)?.valueSnapshot,
    );
    const evidence = context.inputs.flatMap((input) => input.evidence ?? []);
    const reconciliations: ReconciliationResult[] = [];
    const warnings: string[] = [];
    const taxAdjustments: CalculationTaxAdjustment[] = [];
    const value = (key: string) =>
      FixedDecimal.parse(byKey.get(key)!.valueSnapshot!);

    const liabilityKeys = [
      A17_INPUT.LIABILITY_OPENING,
      A17_INPUT.NEW_CONTRACTS,
      A17_INPUT.PAYMENTS,
      A17_INPUT.MONETARY_CORRECTION,
      A17_INPUT.REMEASUREMENTS,
      A17_INPUT.OTHER_MOVEMENTS,
      A17_INPUT.LIABILITY_CLOSING,
    ];
    if (liabilityKeys.every((key) => byKey.get(key)?.valueSnapshot)) {
      const calculated = value(A17_INPUT.LIABILITY_OPENING)
        .add(value(A17_INPUT.NEW_CONTRACTS))
        .add(value(A17_INPUT.MONETARY_CORRECTION))
        .add(value(A17_INPUT.REMEASUREMENTS))
        .add(value(A17_INPUT.OTHER_MOVEMENTS))
        .subtract(value(A17_INPUT.PAYMENTS));
      reconciliations.push(
        this.reconcile(
          "LEASE_LIABILITY",
          calculated,
          value(A17_INPUT.LIABILITY_CLOSING),
          evidence,
        ),
      );
    }
    const deferredKeys = [
      A17_INPUT.DEFERRED_OPENING,
      A17_INPUT.DEFERRED_AMORTIZATION,
      A17_INPUT.DEFERRED_CLOSING,
    ];
    if (deferredKeys.every((key) => byKey.get(key)?.valueSnapshot)) {
      const calculated = value(A17_INPUT.DEFERRED_OPENING).subtract(
        value(A17_INPUT.DEFERRED_AMORTIZATION),
      );
      reconciliations.push(
        this.reconcile(
          "DEFERRED_LEASE_INTEREST",
          calculated,
          value(A17_INPUT.DEFERRED_CLOSING),
          evidence,
        ),
      );
    }
    for (const reconciliation of reconciliations)
      if (reconciliation.status !== "ok")
        warnings.push(...reconciliation.messages);

    this.adjust(
      byKey,
      A17_INPUT.MONETARY_CORRECTION,
      TaxAdjustmentType.RLI_ADD,
      "A17_RLI_MONETARY_CORRECTION",
      "Agregado RLI por corrección monetaria/reajuste informado",
      taxAdjustments,
    );
    this.adjust(
      byKey,
      A17_INPUT.DEFERRED_AMORTIZATION,
      TaxAdjustmentType.RLI_ADD,
      "A17_RLI_DEFERRED_INTEREST_AMORTIZATION",
      "Agregado RLI por amortización de interés diferido informada",
      taxAdjustments,
    );
    this.adjust(
      byKey,
      A17_INPUT.PAYMENTS,
      TaxAdjustmentType.RLI_DEDUCT,
      "A17_RLI_LEASE_PAYMENTS",
      "Deducción RLI por cuotas de leasing pagadas informadas",
      taxAdjustments,
    );
    this.adjust(
      byKey,
      A17_INPUT.DEFERRED_CLOSING,
      TaxAdjustmentType.CPT_ASSET_DEDUCT,
      "A17_CPT_DEFERRED_INTEREST",
      "Ajuste CPT por interés diferido de leasing informado",
      taxAdjustments,
    );
    this.adjust(
      byKey,
      A17_INPUT.LIABILITY_CLOSING,
      TaxAdjustmentType.CPT_LIABILITY_DEDUCT,
      "A17_CPT_LEASE_LIABILITY",
      "Ajuste CPT por obligación de leasing informada",
      taxAdjustments,
    );

    return {
      inputsUsed: [...context.inputs],
      calculatedValues: Object.fromEntries(
        reconciliations.map((r) => [
          `${r.key}_CALCULATED_CLOSING`,
          r.calculatedAmount,
        ]),
      ),
      reconciliations,
      warnings,
      missingInputs,
      taxAdjustments,
      evidence,
    };
  }

  private reconcile(
    key: string,
    calculated: FixedDecimal,
    reported: FixedDecimal,
    evidence: CalculationEvidence[],
  ): ReconciliationResult {
    const difference = calculated.subtract(reported);
    const ok = difference.abs().isZero();
    return {
      key,
      calculatedAmount: calculated.toString(),
      reportedAmount: reported.toString(),
      difference: difference.toString(),
      tolerance: "0.0000",
      status: ok ? "ok" : "warning",
      messages: ok
        ? []
        : [`${key}: el saldo calculado no cuadra con el Balance.`],
      evidence,
    };
  }

  private adjust(
    inputs: Map<string, CalculationInput>,
    key: string,
    type: TaxAdjustmentType,
    ruleKey: string,
    description: string,
    output: CalculationTaxAdjustment[],
  ): void {
    const input = inputs.get(key);
    if (!input?.valueSnapshot || !input.evidence?.length) return;
    const amount = FixedDecimal.parse(input.valueSnapshot).abs();
    if (amount.isZero()) return;
    output.push({
      type,
      amount: amount.toString(),
      description,
      differenceNature: TaxDifferenceNature.TEMPORARY,
      ruleKey,
      evidence: input.evidence,
    });
  }
}

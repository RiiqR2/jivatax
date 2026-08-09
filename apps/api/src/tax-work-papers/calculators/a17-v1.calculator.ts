import {
  CalculationContext,
  CalculationEvidence,
  CalculationInput,
  CalculationResult,
  CalculationTaxAdjustment,
  ReconciliationResult,
  TaxWorkPaperCalculator,
} from "../contracts/tax-work-paper-calculator";
import { TaxAdjustmentType } from "../tax-work-paper.enums";
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
  DEFERRED_ADDITIONS: "NEW_DEFERRED_INTEREST",
  DEFERRED_MONETARY_CORRECTION: "DEFERRED_INTEREST_MONETARY_CORRECTION",
  DEFERRED_REMEASUREMENTS: "DEFERRED_INTEREST_REMEASUREMENTS",
  DEFERRED_OTHER_MOVEMENTS: "OTHER_DEFERRED_INTEREST_MOVEMENTS",
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
    const missingInputs: string[] = REQUIRED.filter(
      (key) => !byKey.get(key)?.valueSnapshot,
    );
    const evidence = context.inputs.flatMap((input) => input.evidence ?? []);
    const reconciliations: ReconciliationResult[] = [];
    const warnings: string[] = [];
    const taxAdjustments: CalculationTaxAdjustment[] = [];
    const value = (key: string) =>
      FixedDecimal.parse(byKey.get(key)!.valueSnapshot!);

    const nonNegativeKeys = [
      A17_INPUT.PAYMENTS,
      A17_INPUT.DEFERRED_AMORTIZATION,
    ];
    const invalidMagnitudeInputs = nonNegativeKeys.filter(
      (key) => byKey.get(key)?.valueSnapshot && value(key).isNegative(),
    );
    for (const key of invalidMagnitudeInputs) {
      missingInputs.push(`${key}_NON_NEGATIVE`);
      warnings.push(
        `${key} debe informarse como magnitud no negativa; no se ocultó el signo recibido.`,
      );
    }

    const liabilityKeys = [
      A17_INPUT.LIABILITY_OPENING,
      A17_INPUT.NEW_CONTRACTS,
      A17_INPUT.PAYMENTS,
      A17_INPUT.MONETARY_CORRECTION,
      A17_INPUT.REMEASUREMENTS,
      A17_INPUT.OTHER_MOVEMENTS,
      A17_INPUT.LIABILITY_CLOSING,
    ];
    if (
      liabilityKeys.every((key) => byKey.get(key)?.valueSnapshot) &&
      !invalidMagnitudeInputs.includes(A17_INPUT.PAYMENTS)
    ) {
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
      A17_INPUT.DEFERRED_ADDITIONS,
      A17_INPUT.DEFERRED_MONETARY_CORRECTION,
      A17_INPUT.DEFERRED_REMEASUREMENTS,
      A17_INPUT.DEFERRED_OTHER_MOVEMENTS,
      A17_INPUT.DEFERRED_AMORTIZATION,
      A17_INPUT.DEFERRED_CLOSING,
    ];
    if (
      deferredKeys.every((key) => byKey.get(key)?.valueSnapshot) &&
      !invalidMagnitudeInputs.includes(A17_INPUT.DEFERRED_AMORTIZATION)
    ) {
      const calculated = value(A17_INPUT.DEFERRED_OPENING)
        .add(value(A17_INPUT.DEFERRED_ADDITIONS))
        .add(value(A17_INPUT.DEFERRED_MONETARY_CORRECTION))
        .add(value(A17_INPUT.DEFERRED_REMEASUREMENTS))
        .add(value(A17_INPUT.DEFERRED_OTHER_MOVEMENTS))
        .subtract(value(A17_INPUT.DEFERRED_AMORTIZATION));
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

    this.signedAdjustment(
      byKey,
      A17_INPUT.MONETARY_CORRECTION,
      TaxAdjustmentType.RLI_ADD,
      TaxAdjustmentType.RLI_DEDUCT,
      "A17_RLI_MONETARY_CORRECTION",
      "Propuesta RLI por corrección monetaria/reajuste informado",
      taxAdjustments,
    );
    this.magnitudeAdjustment(
      byKey,
      A17_INPUT.DEFERRED_AMORTIZATION,
      TaxAdjustmentType.RLI_ADD,
      "A17_RLI_DEFERRED_INTEREST_AMORTIZATION",
      "Propuesta RLI por amortización de interés diferido informada",
      taxAdjustments,
    );
    this.magnitudeAdjustment(
      byKey,
      A17_INPUT.PAYMENTS,
      TaxAdjustmentType.RLI_DEDUCT,
      "A17_RLI_LEASE_PAYMENTS",
      "Propuesta RLI por cuotas de leasing pagadas informadas",
      taxAdjustments,
    );
    this.signedAdjustment(
      byKey,
      A17_INPUT.DEFERRED_CLOSING,
      TaxAdjustmentType.CPT_ASSET_DEDUCT,
      TaxAdjustmentType.CPT_ASSET_ADD,
      "A17_CPT_DEFERRED_INTEREST",
      "Propuesta CPT por interés diferido de leasing informado",
      taxAdjustments,
    );
    this.signedAdjustment(
      byKey,
      A17_INPUT.LIABILITY_CLOSING,
      TaxAdjustmentType.CPT_LIABILITY_DEDUCT,
      TaxAdjustmentType.CPT_LIABILITY_ADD,
      "A17_CPT_LEASE_LIABILITY",
      "Propuesta CPT por obligación de leasing informada",
      taxAdjustments,
    );

    if (taxAdjustments.length)
      warnings.push(
        "Los ajustes tributarios son propuestas draft y requieren resolución profesional antes de finalizar.",
      );
    return {
      inputsUsed: [...context.inputs],
      calculatedValues: Object.fromEntries([
        ...reconciliations.map(
          (r) =>
            [`${r.key}_CALCULATED_CLOSING`, r.calculatedAmount] as [
              string,
              string,
            ],
        ),
        ["requiresProfessionalReview", taxAdjustments.length > 0],
      ]),
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

  private magnitudeAdjustment(
    inputs: Map<string, CalculationInput>,
    key: string,
    type: TaxAdjustmentType,
    ruleKey: string,
    description: string,
    output: CalculationTaxAdjustment[],
  ): void {
    const input = inputs.get(key);
    if (!input?.valueSnapshot || !input.evidence?.length) return;
    const amount = FixedDecimal.parse(input.valueSnapshot);
    if (amount.isNegative()) return;
    if (amount.isZero()) return;
    output.push({
      type,
      amount: amount.toString(),
      description,
      differenceNature: null,
      ruleKey,
      evidence: input.evidence,
    });
  }

  private signedAdjustment(
    inputs: Map<string, CalculationInput>,
    key: string,
    positiveType: TaxAdjustmentType,
    negativeType: TaxAdjustmentType,
    ruleKey: string,
    description: string,
    output: CalculationTaxAdjustment[],
  ): void {
    const input = inputs.get(key);
    if (!input?.valueSnapshot || !input.evidence?.length) return;
    const signedAmount = FixedDecimal.parse(input.valueSnapshot);
    if (signedAmount.isZero()) return;
    const negative = signedAmount.isNegative();
    output.push({
      type: negative ? negativeType : positiveType,
      amount: (negative ? signedAmount.negate() : signedAmount).toString(),
      description: `${description} (signo económico ${negative ? "negativo" : "positivo"})`,
      differenceNature: null,
      ruleKey,
      evidence: input.evidence,
    });
  }
}

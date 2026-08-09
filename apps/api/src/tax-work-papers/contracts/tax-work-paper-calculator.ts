import type {
  TaxAdjustmentType,
  TaxDifferenceNature,
  WorkPaperInputSourceType,
} from "../tax-work-paper.enums";

export interface CalculationEvidence {
  type: string;
  sourceEntityType: string;
  sourceEntityId: string;
  locator?: Record<string, unknown>;
}
export interface CalculationInput {
  inputKey: string;
  sourceType: WorkPaperInputSourceType;
  sourceEntityType?: string;
  sourceEntityId?: string;
  valueSnapshot?: string;
  payloadSnapshot?: Record<string, unknown>;
  evidence?: CalculationEvidence[];
}
export interface ReconciliationResult {
  calculatedAmount: string;
  reportedAmount: string;
  difference: string;
  tolerance?: string;
  status: "ok" | "warning" | "error";
  messages: string[];
  evidence?: CalculationEvidence[];
}
export interface CalculationTaxAdjustment {
  type: TaxAdjustmentType;
  amount: string;
  description: string;
  differenceNature?: TaxDifferenceNature;
  ruleKey: string;
  evidence?: CalculationEvidence[];
}
export interface CalculationContext {
  companyId: string;
  taxPeriodId: string;
  executionId: string;
  definitionCode: string;
  definitionVersion: number;
  inputs: readonly CalculationInput[];
}
export interface CalculationResult {
  inputsUsed: CalculationInput[];
  calculatedValues: Record<string, string | number | boolean | null>;
  reconciliation?: ReconciliationResult;
  warnings: string[];
  missingInputs: string[];
  taxAdjustments: CalculationTaxAdjustment[];
  evidence: CalculationEvidence[];
}
export interface TaxWorkPaperCalculator {
  readonly definitionCode: string;
  readonly definitionVersion: number;
  calculate(context: CalculationContext): Promise<CalculationResult>;
}

export class TaxWorkPaperCalculatorRegistry {
  private readonly calculators = new Map<string, TaxWorkPaperCalculator>();
  register(calculator: TaxWorkPaperCalculator): void {
    const key = this.key(
      calculator.definitionCode,
      calculator.definitionVersion,
    );
    if (this.calculators.has(key))
      throw new Error(`Calculator already registered: ${key}`);
    this.calculators.set(key, calculator);
  }
  get(code: string, version: number): TaxWorkPaperCalculator | undefined {
    return this.calculators.get(this.key(code, version));
  }
  private key(code: string, version: number): string {
    return `${code}@${version}`;
  }
}

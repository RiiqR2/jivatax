import { Injectable } from "@nestjs/common";
import type {
  AccountObservation,
  CompatibilityResult,
} from "./account-matching-pipeline.types";
import { AccountObservationClassifierService } from "./account-observation-classifier.service";

@Injectable()
export class AccountCompatibilityFilterService {
  constructor(
    private readonly classifier = new AccountObservationClassifierService(),
  ) {}

  evaluate(
    source: AccountObservation,
    destinationName: string,
  ): CompatibilityResult {
    const destination = this.classifier.classify(destinationName);
    const reasons: string[] = [];
    if (
      source.temporalClass &&
      destination.temporalClass &&
      source.temporalClass !== destination.temporalClass
    )
      reasons.push("incompatible_temporal_class");
    const sourceSection = source.observedSection.replace("contra_", "");
    const destinationSection = destination.observedSection.replace(
      "contra_",
      "",
    );
    if (
      sourceSection !== "unknown" &&
      destinationSection !== "unknown" &&
      sourceSection !== destinationSection
    )
      reasons.push("incompatible_statement_section");
    if (
      source.balanceNature !== "unknown" &&
      destination.balanceNature !== "unknown" &&
      source.balanceNature !== destination.balanceNature
    )
      reasons.push("incompatible_balance_nature");
    const sourceResultClass = /^(?:ingreso|renta|venta)\b/.test(
      source.normalizedName,
    )
      ? "income"
      : /^(?:gasto|costo)\b/.test(source.normalizedName)
        ? "expense"
        : undefined;
    const destinationResultClass = /^(?:ingreso|renta|venta)\b/.test(
      destination.normalizedName,
    )
      ? "income"
      : /^(?:gasto|costo)\b/.test(destination.normalizedName)
        ? "expense"
        : undefined;
    if (
      sourceResultClass &&
      destinationResultClass &&
      sourceResultClass !== destinationResultClass
    )
      reasons.push("incompatible_result_class");
    if (
      source.accountFamily === "cash" &&
      /existencias en transito|pagos basados en acciones/.test(
        destination.normalizedName,
      )
    )
      reasons.push("cash_bridge_incompatible_destination");
    if (
      source.accountFamily === "bad_debt_allowance" &&
      /por pagar|pasivo/.test(destination.normalizedName)
    )
      reasons.push("receivable_allowance_vs_liability_provision");
    if (
      source.accountFamily === "loan_receivable" &&
      /por pagar/.test(destination.normalizedName)
    )
      reasons.push("receivable_vs_payable");
    if (
      destination.specialTaxCategory !== "none" &&
      source.specialTaxCategory !== destination.specialTaxCategory
    )
      reasons.push("protected_tax_category_requires_explicit_evidence");
    if (
      destination.relationshipClass === "related_party" &&
      source.relationshipClass !== "related_party"
    )
      reasons.push("related_party_requires_explicit_evidence");
    return {
      compatible: reasons.length === 0,
      exclusionReasons: reasons,
      warnings: [],
    };
  }
}

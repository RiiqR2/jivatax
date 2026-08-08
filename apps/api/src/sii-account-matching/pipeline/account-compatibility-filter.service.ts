import { Injectable } from "@nestjs/common";
import type {
  AccountObservation,
  CompatibilityResult,
  PipelineCatalogAccount,
} from "./account-matching-pipeline.types";
import { AccountObservationClassifierService } from "./account-observation-classifier.service";

type FinancialSubfamily =
  | "cash_and_bank"
  | "marketable_securities"
  | "trade_receivables"
  | "notes_receivable"
  | "loan_receivable"
  | "guarantees_and_deposits"
  | "financial_investments"
  | "lease_assets"
  | "lease_liabilities";

@Injectable()
export class AccountCompatibilityFilterService {
  constructor(
    private readonly classifier = new AccountObservationClassifierService(),
  ) {}

  evaluateCatalog(
    source: AccountObservation,
    destination: PipelineCatalogAccount,
  ): CompatibilityResult {
    return this.evaluate(
      source,
      this.classifier.classify({
        accountCode: destination.code,
        accountName: destination.name,
        isLeaf: destination.isLeaf,
        active: destination.active,
        mappable: destination.mappable,
        parentCode: destination.parentCode,
        level: destination.level,
      }),
    );
  }

  evaluate(
    source: AccountObservation,
    destination: AccountObservation | string,
  ): CompatibilityResult {
    const target =
      typeof destination === "string"
        ? this.classifier.classify(destination)
        : destination;
    const reasons: string[] = [];
    const warnings: string[] = [];
    const evidence: string[] = [];
    const exclude = (reason: string) => {
      if (!reasons.includes(reason)) reasons.push(reason);
    };

    const eligibility = target.destinationMetadata;
    if (eligibility?.active === false) exclude("destination_inactive");
    if (eligibility?.mappable === false) exclude("destination_not_mappable");
    if (eligibility?.isLeaf === false) exclude("destination_grouping_node");

    if (source.temporalClass && target.temporalClass) {
      if (source.temporalClass !== target.temporalClass)
        exclude("incompatible_temporal_class");
      else evidence.push(`temporal_class:${source.temporalClass}`);
    } else {
      warnings.push("temporal_class_undetermined");
    }

    const sourceSection = source.observedSection;
    const targetSection = target.observedSection;
    if (sourceSection !== "unknown" && targetSection !== "unknown") {
      const sameBase =
        sourceSection.replace("contra_", "") ===
        targetSection.replace("contra_", "");
      if (!sameBase) exclude("incompatible_statement_section");
      else evidence.push(`statement_section:${sourceSection}:${targetSection}`);
    } else warnings.push("insufficient_compatibility_evidence");

    if (
      source.balanceNature !== "unknown" &&
      target.balanceNature !== "unknown"
    ) {
      if (source.balanceNature !== target.balanceNature)
        exclude("incompatible_balance_nature");
      else evidence.push(`balance_nature:${source.balanceNature}`);
    }

    const sourceDirection = this.direction(source.normalizedName);
    const targetDirection = this.direction(target.normalizedName);
    if (
      sourceDirection &&
      targetDirection &&
      sourceDirection !== targetDirection
    )
      exclude("receivable_payable_direction_mismatch");

    if (
      source.accountFamily !== "unknown" &&
      target.accountFamily !== "unknown" &&
      source.accountFamily !== target.accountFamily
    )
      exclude("incompatible_account_family");

    const sourceSubfamily = this.financialSubfamily(source);
    const targetSubfamily = this.financialSubfamily(target);
    if (sourceSubfamily && targetSubfamily) {
      if (sourceSubfamily !== targetSubfamily)
        exclude("incompatible_financial_subfamily");
      else evidence.push(`financial_subfamily:${sourceSubfamily}`);
    }

    const deferredTaxDirectionUnspecified =
      source.specialTaxCategory === "deferred_tax_unspecified" &&
      (target.specialTaxCategory === "deferred_tax_asset" ||
        target.specialTaxCategory === "deferred_tax_liability");
    if (deferredTaxDirectionUnspecified)
      warnings.push("deferred_tax_direction_unspecified");
    else if (
      (target.specialTaxCategory !== "none" ||
        source.specialTaxCategory !== "none") &&
      source.specialTaxCategory !== target.specialTaxCategory
    )
      exclude("protected_tax_category_requires_explicit_evidence");
    else if (target.specialTaxCategory !== "none")
      evidence.push(`protected_tax_category:${target.specialTaxCategory}`);

    if (
      target.relationshipClass === "related_party" &&
      source.relationshipClass !== "related_party"
    )
      exclude("related_party_requires_explicit_evidence");
    if (
      source.relationshipClass === "related_party" &&
      target.relationshipClass !== "related_party"
    )
      warnings.push("related_source_destination_relation_unspecified");

    if (this.isBridge(source.normalizedName)) {
      if (!this.isBridge(target.normalizedName))
        exclude("bridge_account_requires_explicit_destination");
      if (/existencias|pagos basados en acciones/.test(target.normalizedName))
        exclude("bridge_account_incompatible_destination");
    }

    const shared = this.sharedMeaningfulTokens(
      source.normalizedName,
      target.normalizedName,
    );
    if (
      source.normalizedName !== target.normalizedName &&
      shared.length === 0 &&
      evidence.length === 0
    ) {
      if (
        source.observedSection === "unknown" &&
        source.balanceNature === "unknown"
      )
        warnings.push("insufficient_compatibility_evidence");
      else exclude("insufficient_compatibility_evidence");
    }
    if (shared.length)
      evidence.push(`shared_specific_tokens:${shared.join(",")}`);
    if (source.normalizedName === target.normalizedName)
      evidence.push("exact_normalized_name");

    const compatible = reasons.length === 0;
    return {
      compatible,
      exclusionReasons: reasons,
      warnings,
      compatibilityEvidence: evidence,
      compatibilityLevel: !compatible
        ? "incompatible"
        : source.normalizedName === target.normalizedName
          ? "exact"
          : warnings.length
            ? "uncertain"
            : "compatible",
    };
  }

  private direction(name: string): "receivable" | "payable" | undefined {
    if (/por cobrar|cobranza judicial|deudor|cliente/.test(name))
      return "receivable";
    if (
      /por pagar|proveedor|obligacion|pasivo.*prestamo|pasivo financiero/.test(
        name,
      )
    )
      return "payable";
    return undefined;
  }

  private financialSubfamily(
    observation: AccountObservation,
  ): FinancialSubfamily | undefined {
    const name = observation.normalizedName;
    // Loans (and their interest) are receivables, never marketable securities
    // without explicit negotiable-instrument language.
    if (
      /prestamos?.*por cobrar|intereses?.*(?:de |por )?prestamos?.*por cobrar/.test(
        name,
      ) &&
      !/instrumentos? negociables?|valores? negociables?/.test(name)
    )
      return "loan_receivable";
    if (/valores? negociables?|instrumentos? negociables?/.test(name))
      return "marketable_securities";
    if (
      /cheques?.*por cobrar|deudores?.*cobranza judicial|cuentas?.*por cobrar/.test(
        name,
      )
    )
      return "trade_receivables";
    if (/pagare.*por cobrar|documentos?.*por cobrar/.test(name))
      return "notes_receivable";
    if (/garantia|deposito.*garantia/.test(name))
      return "guarantees_and_deposits";
    if (/inversion(?:es)? financiera/.test(name))
      return "financial_investments";
    if (/derecho de uso|activo.*arrendamiento/.test(name))
      return "lease_assets";
    if (/pasivo.*arrendamiento/.test(name)) return "lease_liabilities";
    if (/caja|banco|disponible|efectivo/.test(name)) return "cash_and_bank";
    return undefined;
  }

  private isBridge(name: string): boolean {
    return /cuenta puente|pagos? en transito|cuenta transitoria/.test(name);
  }

  private sharedMeaningfulTokens(left: string, right: string): string[] {
    const generic = new Set([
      "gasto",
      "gastos",
      "ingreso",
      "ingresos",
      "pago",
      "pagos",
      "credito",
      "interes",
      "fondo",
      "corriente",
      "provision",
      "transito",
      "comercial",
      "comun",
      "cuenta",
      "cuentas",
      "por",
      "para",
      "del",
      "los",
      "las",
    ]);
    const rightTokens = new Set(right.split(" "));
    return [...new Set(left.split(" "))].filter(
      (token) =>
        token.length > 2 && !generic.has(token) && rightTokens.has(token),
    );
  }
}

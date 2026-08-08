import { Injectable } from "@nestjs/common";
import type {
  AccountObservation,
  CompatibilityResult,
  PipelineCatalogAccount,
} from "./account-matching-pipeline.types";
import { AccountObservationClassifierService } from "./account-observation-classifier.service";
import {
  catalogChapterSection,
  isResultChapter,
} from "../metadata/sii-catalog-hierarchy";

type FinancialSubfamily =
  | "cash_and_bank"
  | "marketable_securities"
  | "trade_receivables"
  | "judicial_receivables"
  | "lease_receivables"
  | "notes_receivable"
  | "loan_receivable"
  | "employee_loans"
  | "loan_payable"
  | "trade_payables"
  | "guarantees_and_deposits"
  | "financial_investments"
  | "lease_assets"
  | "lease_liabilities"
  | "lease_purchase_option";

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
      this.classifier.classify(
        {
          accountCode: destination.code,
          accountName: destination.name,
          isLeaf: destination.isLeaf,
          active: destination.active,
          mappable: destination.mappable,
          parentCode: destination.parentCode,
          level: destination.level,
        },
        {
          catalogHierarchySection: catalogChapterSection(destination.code),
          catalogResultChapter: isResultChapter(destination.code),
          catalogKnowledge: destination.knowledge,
        },
      ),
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
      target.accountFamily !== "unknown"
    ) {
      if (source.accountFamily !== target.accountFamily)
        exclude("incompatible_account_family");
      else evidence.push(`account_family:${source.accountFamily}`);
    }

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
    // A related-party source must not resolve into an ordinary third-party
    // destination by lexical overlap alone; prefer no_candidate over a
    // generic "Cuentas por pagar" / "Otros activos" catch-all.
    if (
      source.relationshipClass === "related_party" &&
      target.relationshipClass !== "related_party"
    )
      exclude("related_source_destination_relation_unspecified");

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
      /anticipo(?:s)? y prestamos? a|prestamos? a (?:los )?empleados/.test(
        name,
      )
    )
      return "employee_loans";
    if (
      /prestamos?.*por cobrar|intereses?.*(?:de |por )?prestamos?.*por cobrar/.test(
        name,
      ) &&
      !/instrumentos? negociables?|valores? negociables?/.test(name)
    )
      return "loan_receivable";
    if (/prestamos?.*por pagar|intereses?.*prestamos?.*por pagar/.test(name))
      return "loan_payable";
    if (/valores? negociables?|instrumentos? negociables?/.test(name))
      return "marketable_securities";
    if (/fondos? mutuos?/.test(name)) return "financial_investments";
    if (/fondo opcion de compra|opcion de compra.*(?:leasing|arrendamiento)/.test(
      name,
    ))
      return "lease_purchase_option";
    if (/deudores?.*leasing|leasing.*deudor/.test(name))
      return "lease_receivables";
    // Judicial collection is a distinct trade-receivable flavour; it must not
    // collapse into generic "Deudores varios" / "Deudores a largo plazo" just
    // because both sit under the broad receivables umbrella.
    if (/deudores?.*cobranza judicial|cobranza judicial/.test(name))
      return "judicial_receivables";
    if (
      /cheques?.*por cobrar|cuentas?.*por cobrar|deudores? por venta|deudores? varios|deudores? a largo plazo/.test(
        name,
      )
    )
      return "trade_receivables";
    if (/pagare.*por cobrar|documentos?.*por cobrar/.test(name))
      return "notes_receivable";
    if (/cuentas? por pagar|proveedores? por pagar/.test(name))
      return "trade_payables";
    if (/garantia|deposito.*garantia|fondo(?:s)? de garantias?/.test(name))
      return "guarantees_and_deposits";
    if (/inversion(?:es)? financiera/.test(name))
      return "financial_investments";
    if (/derecho de uso|activo.*arrendamiento/.test(name))
      return "lease_assets";
    if (/pasivo.*arrendamiento|obligacion.*leasing/.test(name))
      return "lease_liabilities";
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
      "pagar",
      "cobrar",
      "credito",
      "interes",
      "intereses",
      "fondo",
      "fondos",
      "deudor",
      "deudores",
      "prestamo",
      "prestamos",
      "corriente",
      "corrientes",
      "provision",
      "provisiones",
      "transito",
      "comercial",
      "comun",
      "cuenta",
      "cuentas",
      "activo",
      "activos",
      "pasivo",
      "pasivos",
      "fijo",
      "fijos",
      "explotacion",
      "resultado",
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

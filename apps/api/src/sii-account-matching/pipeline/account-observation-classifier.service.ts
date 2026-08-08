import { Injectable } from "@nestjs/common";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import { accountingMetadata } from "../metadata/accounting-metadata";
import {
  classifyPipelineAccountFamily,
  PIPELINE_ACCOUNT_FAMILIES,
} from "./account-family-taxonomy";
import type {
  BalanceNature,
  ObservedAccountSection,
} from "../account-matching.types";
import type {
  AccountObservation,
  AccountObservationInput,
  CatalogAccountKnowledge,
  ContraAccountType,
  SpecialTaxCategory,
} from "./account-matching-pipeline.types";
import { decimalValueState } from "./decimal-value";

/**
 * Only ever supplied by `AccountCompatibilityFilterService.evaluateCatalog`,
 * which knows the input is a real, currently imported SII catalogue account.
 * It must never be inferred from an arbitrary company ERP code.
 */
export interface ClassifyDestinationHints {
  catalogHierarchySection?: ObservedAccountSection;
  catalogKnowledge?: CatalogAccountKnowledge;
}

@Injectable()
export class AccountObservationClassifierService {
  classify(
    input: AccountObservationInput,
    hints?: ClassifyDestinationHints,
  ): AccountObservation;
  classify(name: string): AccountObservation;
  classify(
    value: AccountObservationInput | string,
    hints?: ClassifyDestinationHints,
  ): AccountObservation {
    const input: AccountObservationInput =
      typeof value === "string"
        ? { accountCode: "", accountName: value }
        : value;
    const originalName = input.accountName;
    const name = normalizeAccountTerm(originalName);
    const metadata = accountingMetadata(name);
    // accountingMetadata owns the audited contra rules. This deliberately
    // narrow local fallback only covers an explicit phrase absent there.
    const localContraFallback = /cuenta complementaria (?:de )?activo/.test(
      name,
    );
    const knowledgeSection = hints?.catalogKnowledge?.statementSection;
    const explicitContra =
      (metadata.contraAccount && !/^deuda incobrable$/.test(name)) ||
      localContraFallback ||
      hints?.catalogKnowledge?.isContraAccount === true;
    const lexicalSection: ObservedAccountSection | undefined =
      /\bactivo\b/.test(name)
        ? "asset"
        : /\bpasivo\b/.test(name)
          ? "liability"
          : /^(?:ingreso|renta|venta)\b/.test(name)
            ? "income"
            : /^(?:gasto|costo)\b/.test(name)
              ? "expense"
              : undefined;
    const accountFamily = classifyPipelineAccountFamily(name);
    const family =
      accountFamily === "unknown"
        ? undefined
        : PIPELINE_ACCOUNT_FAMILIES[accountFamily];
    const evidence: string[] = [];
    const warnings: string[] = [];

    const sectionSignals = (
      [
        ["assetAmount", "asset"],
        ["liabilityAmount", "liability"],
        ["lossAmount", "expense"],
        ["gainAmount", "income"],
      ] as const
    ).filter(([field]) => this.positive(input[field], field, warnings));
    let structuralSection: ObservedAccountSection = "unknown";
    if (sectionSignals.length === 1) {
      structuralSection = sectionSignals[0][1];
      evidence.push(`balance:${sectionSignals[0][0]}:positive`);
    } else if (sectionSignals.length > 1) {
      warnings.push(
        `contradictory_balance_sections:${sectionSignals.map(([, section]) => section).join(",")}`,
      );
      evidence.push(
        ...sectionSignals.map(([field]) => `balance:${field}:positive`),
      );
    }

    // Explicit contra/equity accounting metadata survives the physical Balance column.
    const metadataOverride = explicitContra
      ? accountFamily === "bad_debt_allowance"
        ? "contra_asset"
        : metadata.statementSection === "liability" ||
            knowledgeSection === "liability"
          ? "contra_liability"
          : "contra_asset"
      : knowledgeSection === "equity" || metadata.statementSection === "equity"
        ? "equity"
        : undefined;
    const structurallyContradictory = sectionSignals.length > 1;
    const deferredTaxWithoutDirection =
      /impuesto.*diferido/.test(name) &&
      !/\b(?:activo|pasivo)\b/.test(name) &&
      structuralSection === "unknown";
    // Curated knowledge and the stable SII chapter (1 = asset, 2.03 = equity,
    // 2.* = liability) are structural facts about the destination account
    // itself; they take precedence over a lexical guess from its own name
    // (e.g. an asset named "Gastos Diferidos" must not read as an expense),
    // but never over an explicit Balance column or contra/equity override.
    const structuralOverrideSection: ObservedAccountSection | undefined =
      knowledgeSection && knowledgeSection !== "unknown"
        ? knowledgeSection
        : hints?.catalogHierarchySection;
    const observedSection: ObservedAccountSection =
      metadataOverride ??
      (structurallyContradictory
        ? "unknown"
        : structuralSection !== "unknown"
          ? structuralSection
          : (structuralOverrideSection ??
            family?.section ??
            lexicalSection ??
            (!deferredTaxWithoutDirection &&
            metadata.statementSection !== "unknown"
              ? metadata.statementSection
              : "unknown")));
    if (metadataOverride) {
      evidence.push(
        explicitContra
          ? `contra_account:${metadata.contraAccount ? "accounting_metadata" : "explicit_local_fallback"}:${metadataOverride}`
          : `explicit_equity_metadata:${metadataOverride}`,
      );
    } else if (structuralSection === "unknown" && knowledgeSection)
      evidence.push(`catalog_knowledge:${knowledgeSection}`);
    else if (structuralSection === "unknown" && hints?.catalogHierarchySection)
      evidence.push(`catalog_chapter:${hints.catalogHierarchySection}`);
    else if (structuralSection === "unknown" && family)
      evidence.push(`v2_family:${accountFamily}`);
    else if (
      structuralSection === "unknown" &&
      metadata.statementSection !== "unknown"
    )
      evidence.push(`accounting_metadata:${metadata.statementSection}`);

    const debitPositive = this.positive(
      input.debitBalance,
      "debitBalance",
      warnings,
    );
    const creditPositive = this.positive(
      input.creditBalance,
      "creditBalance",
      warnings,
    );
    let balanceNature: BalanceNature | "unknown";
    if (hints?.catalogKnowledge?.balanceNature)
      balanceNature = hints.catalogKnowledge.balanceNature;
    else if (explicitContra) balanceNature = metadata.expectedBalanceNature;
    else if (debitPositive && creditPositive) {
      balanceNature = "unknown";
      warnings.push("contradictory_balance_natures:debit,credit");
      evidence.push(
        "balance:debitBalance:positive",
        "balance:creditBalance:positive",
      );
    } else if (debitPositive || creditPositive) {
      balanceNature = debitPositive ? "debit" : "credit";
      evidence.push(
        `balance:${debitPositive ? "debitBalance" : "creditBalance"}:positive`,
      );
    } else if (observedSection === "unknown") balanceNature = "unknown";
    else
      balanceNature = [
        "liability",
        "equity",
        "income",
        "contra_asset",
      ].includes(observedSection)
        ? "credit"
        : "debit";

    const contraAccountType: ContraAccountType =
      observedSection === "contra_asset"
        ? "asset_allowance"
        : observedSection === "contra_liability"
          ? "liability_allowance"
          : "none";
    return {
      observedSection,
      balanceNature,
      accountFamily,
      temporalClass:
        hints?.catalogKnowledge?.isCurrent == null
          ? this.temporalClass(name)
          : hints.catalogKnowledge.isCurrent
            ? "current"
            : "non_current",
      relationshipClass: /\brel\b|relacionad|intercompania/.test(name)
        ? "related_party"
        : "unknown",
      contraAccountType,
      specialTaxCategory: this.taxCategory(name, structuralSection),
      normalizedName: name,
      originalName,
      classificationEvidence: evidence,
      classificationWarnings: warnings,
      destinationMetadata: {
        isLeaf: input.isLeaf,
        active: input.active,
        mappable: input.mappable,
        parentCode: input.parentCode,
        level: input.level,
      },
    };
  }

  private positive(
    value: string | null | undefined,
    field: string,
    warnings: string[],
  ): boolean {
    const state = decimalValueState(value);
    if (state === "invalid") warnings.push(`invalid_decimal:${field}`);
    return state === "positive";
  }

  private temporalClass(name: string): AccountObservation["temporalClass"] {
    if (/\b(no corrientes?|largo plazo|nc|lp)\b/.test(name))
      return "non_current";
    if (/cuenta corriente/.test(name)) return undefined;
    if (/\b(corto plazo|corrientes?)\b/.test(name)) return "current";
    return undefined;
  }

  private taxCategory(
    name: string,
    structuralSection: ObservedAccountSection,
  ): SpecialTaxCategory {
    if (/gasto.*rechazad/.test(name)) return "rejected_expense";
    if (/perdida tributaria.*arrastre/.test(name))
      return "tax_loss_carryforward";
    if (/donacion/.test(name)) return "donation";
    if (/gasto.*no documentad/.test(name)) return "undocumented_expense";
    if (/multa.*tributaria/.test(name)) return "tax_fine";
    if (/renta.*extranjera|ingreso.*extranjero/.test(name))
      return "foreign_income";
    if (/iva credito fiscal/.test(name)) return "vat_credit";
    if (/iva debito fiscal/.test(name)) return "vat_debit";
    if (/provision.*impuesto|impuesto.*provision/.test(name))
      return "tax_provision";
    if (/impuesto.*(?:renta|primera categoria)/.test(name)) return "income_tax";
    if (/impuesto.*diferido/.test(name))
      return /pasivo/.test(name) || structuralSection === "liability"
        ? "deferred_tax_liability"
        : /activo/.test(name) || structuralSection === "asset"
          ? "deferred_tax_asset"
          : "deferred_tax_unspecified";
    if (/parte.*relacionad|empresa.*relacionad/.test(name))
      return "related_party";
    return "none";
  }
}

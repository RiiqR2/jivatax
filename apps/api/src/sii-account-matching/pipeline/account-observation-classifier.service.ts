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
  ContraAccountType,
  SpecialTaxCategory,
} from "./account-matching-pipeline.types";
import { decimalValueState } from "./decimal-value";

@Injectable()
export class AccountObservationClassifierService {
  classify(input: AccountObservationInput): AccountObservation;
  classify(name: string): AccountObservation;
  classify(value: AccountObservationInput | string): AccountObservation {
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
    const explicitContra =
      (metadata.contraAccount && !/^deuda incobrable$/.test(name)) ||
      localContraFallback;
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
        : metadata.statementSection === "liability"
          ? "contra_liability"
          : "contra_asset"
      : metadata.statementSection === "equity"
        ? "equity"
        : undefined;
    const structurallyContradictory = sectionSignals.length > 1;
    const observedSection: ObservedAccountSection =
      metadataOverride ??
      (structurallyContradictory
        ? "unknown"
        : structuralSection !== "unknown"
          ? structuralSection
          : (family?.section ??
            lexicalSection ??
            (metadata.statementSection !== "unknown"
              ? metadata.statementSection
              : "unknown")));
    if (metadataOverride) {
      evidence.push(
        explicitContra
          ? `contra_account:${metadata.contraAccount ? "accounting_metadata" : "explicit_local_fallback"}:${metadataOverride}`
          : `explicit_equity_metadata:${metadataOverride}`,
      );
    } else if (structuralSection === "unknown" && family)
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
    if (explicitContra) balanceNature = metadata.expectedBalanceNature;
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
      temporalClass: metadata.term,
      relationshipClass: /relacionad/.test(name) ? "related_party" : "unknown",
      contraAccountType,
      specialTaxCategory: this.taxCategory(name),
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

  private taxCategory(name: string): SpecialTaxCategory {
    if (/gasto.*rechazad/.test(name)) return "rejected_expense";
    if (/donacion/.test(name)) return "donation";
    if (/gasto.*no documentad/.test(name)) return "undocumented_expense";
    if (/multa.*tributaria/.test(name)) return "tax_fine";
    if (/renta.*extranjera|ingreso.*extranjero/.test(name))
      return "foreign_income";
    if (/impuesto.*diferido/.test(name)) return "deferred_tax";
    if (/parte.*relacionad|empresa.*relacionad/.test(name))
      return "related_party";
    return "none";
  }
}

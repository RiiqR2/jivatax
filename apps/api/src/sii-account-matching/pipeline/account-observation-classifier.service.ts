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
  ContraAccountType,
  SpecialTaxCategory,
} from "./account-matching-pipeline.types";

@Injectable()
export class AccountObservationClassifierService {
  classify(originalName: string): AccountObservation {
    const name = normalizeAccountTerm(originalName);
    const metadata = accountingMetadata(name);
    const accountFamily = classifyPipelineAccountFamily(name);
    const familyDefinition =
      accountFamily === "unknown"
        ? undefined
        : PIPELINE_ACCOUNT_FAMILIES[accountFamily];
    const specialTaxCategory = this.taxCategory(name);
    const explicitSection = /\bactivo\b/.test(name)
      ? ("asset" as const)
      : /\bpasivo\b/.test(name)
        ? ("liability" as const)
        : /^(?:ingreso|renta|venta)\b/.test(name)
          ? ("income" as const)
          : /^(?:gasto|costo)\b/.test(name)
            ? ("expense" as const)
            : undefined;
    const familySection = familyDefinition?.section;
    const metadataSection = metadata.statementSection;
    const baseSection =
      familySection ??
      (metadataSection !== "unknown" ? metadataSection : explicitSection) ??
      "unknown";
    const metadataContraSection = metadata.contraAccount
      ? metadataSection === "liability"
        ? ("contra_liability" as const)
        : ("contra_asset" as const)
      : undefined;
    const observedSection: ObservedAccountSection =
      familySection === "contra_asset"
        ? "contra_asset"
        : (metadataContraSection ?? baseSection);
    const contraAccountType: ContraAccountType =
      observedSection === "contra_asset"
        ? "asset_allowance"
        : observedSection === "contra_liability"
          ? "liability_allowance"
          : "none";
    const balanceNature = this.resolveBalanceNature({
      observedSection,
      hasSpecificFamily: familyDefinition !== undefined,
      metadataContraAccount: metadata.contraAccount,
      metadataSection,
      metadataNature: metadata.expectedBalanceNature,
    });

    return {
      observedSection,
      balanceNature,
      accountFamily,
      temporalClass: metadata.term,
      relationshipClass: /relacionad/.test(name) ? "related_party" : "unknown",
      contraAccountType,
      specialTaxCategory,
      normalizedName: name,
      originalName,
    };
  }

  private resolveBalanceNature(input: {
    observedSection: ObservedAccountSection;
    hasSpecificFamily: boolean;
    metadataContraAccount: boolean;
    metadataSection: string;
    metadataNature: BalanceNature;
  }): BalanceNature | "unknown" {
    if (input.observedSection === "contra_asset") return "credit";
    if (input.observedSection === "contra_liability") return "debit";
    if (
      input.metadataContraAccount ||
      (!input.hasSpecificFamily && input.metadataSection !== "unknown")
    )
      return input.metadataNature;
    if (input.observedSection === "unknown") return "unknown";
    return input.observedSection === "liability" ||
      input.observedSection === "equity" ||
      input.observedSection === "income"
      ? "credit"
      : "debit";
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

import { Injectable } from "@nestjs/common";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import { accountingMetadata } from "../metadata/accounting-metadata";
import {
  classifyPipelineAccountFamily,
  PIPELINE_ACCOUNT_FAMILIES,
} from "./account-family-taxonomy";
import type {
  AccountObservation,
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
    const observedSection =
      familyDefinition?.section ?? explicitSection ?? metadata.statementSection;
    const isContraAsset = observedSection === "contra_asset";
    const balanceNature =
      observedSection === "unknown"
        ? "unknown"
        : isContraAsset ||
            observedSection === "liability" ||
            observedSection === "equity" ||
            observedSection === "income"
          ? "credit"
          : "debit";

    return {
      observedSection,
      balanceNature,
      accountFamily,
      temporalClass: metadata.term,
      relationshipClass: /relacionad/.test(name) ? "related_party" : "unknown",
      contraAccountType: isContraAsset ? "asset_allowance" : "none",
      specialTaxCategory,
      normalizedName: name,
      originalName,
    };
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

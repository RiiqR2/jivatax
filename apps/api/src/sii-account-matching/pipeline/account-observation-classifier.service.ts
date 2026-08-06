import { Injectable } from "@nestjs/common";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import type {
  AccountObservation,
  SpecialTaxCategory,
} from "./account-matching-pipeline.types";

const includes = (value: string, expression: RegExp) => expression.test(value);

@Injectable()
export class AccountObservationClassifierService {
  classify(originalName: string): AccountObservation {
    const name = normalizeAccountTerm(originalName);
    const specialTaxCategory = this.taxCategory(name);
    const isBadDebt = includes(
      name,
      /incobrable|deterioro.*(?:cliente|deudor)/,
    );
    const observedSection = includes(
      name,
      /capital|resultado acumulado|patrimonio/,
    )
      ? "equity"
      : includes(name, /ingreso|renta|venta/)
        ? "income"
        : includes(name, /gasto|costo|multa|donacion/)
          ? "expense"
          : includes(
                name,
                /proveedor|por pagar|obligacion|pasivo|debito fiscal/,
              )
            ? "liability"
            : includes(
                  name,
                  /caja|banco|disponible|por cobrar|anticipo|credito fiscal|activo|fondo mutuo|pagos en transito/,
                )
              ? "asset"
              : "unknown";
    const temporalClass = /no corriente|largo plazo/.test(name)
      ? ("non_current" as const)
      : /corriente|corto plazo/.test(name) && !/cuenta corriente/.test(name)
        ? ("current" as const)
        : undefined;

    return {
      observedSection: isBadDebt ? "contra_asset" : observedSection,
      balanceNature:
        observedSection === "liability" ||
        observedSection === "equity" ||
        observedSection === "income"
          ? "credit"
          : "debit",
      accountFamily: this.family(name),
      temporalClass,
      relationshipClass: /relacionad/.test(name) ? "related_party" : "unknown",
      contraAccountType: isBadDebt ? "asset_allowance" : "none",
      specialTaxCategory,
      normalizedName: name,
      originalName,
    };
  }

  private family(name: string): string {
    if (/caja|banco|disponible|pagos en transito/.test(name)) return "cash";
    if (/iva credito fiscal/.test(name)) return "vat_credit";
    if (/iva debito fiscal/.test(name)) return "vat_debit";
    if (/anticipo.*proveedor/.test(name)) return "supplier_advance";
    if (/proveedor/.test(name)) return "trade_payable";
    if (/obligacion.*banc|prestamo banc/.test(name)) return "bank_debt";
    if (/capital emitido/.test(name)) return "issued_capital";
    if (/prestamo.*por cobrar/.test(name)) return "loan_receivable";
    if (/incobrable/.test(name)) return "bad_debt_allowance";
    return "unknown";
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

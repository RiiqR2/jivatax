import {
  normalizeAccountTerm,
  relevantWords,
} from "../normalization/account-term-normalizer";
import type {
  AccountingMetadata,
  StatementSection,
} from "../account-matching.types";

const FAMILY_RULES: ReadonlyArray<[RegExp, string, StatementSection]> = [
  [/depreciacion|amortizacion/, "depreciation", "asset"],
  [/caja|banco|disponible|efectivo/, "cash", "asset"],
  [/cliente|deudor|cobrar/, "receivables", "asset"],
  [/maquinaria|equipo|vehiculo|inmueble|activo fijo/, "fixed_assets", "asset"],
  [/proveedor|pagar/, "payables", "liability"],
  [/deuda|obligacion|prestamo|leasing/, "financial_liabilities", "liability"],
  [/iva|impuesto|ppm|retencion/, "taxes", "liability"],
  [/capital|patrimonio|utilidad acumulada/, "equity", "equity"],
  [/venta|ingreso|ganancia/, "income", "income"],
  [/gasto|costo|perdida|remuneracion|honorario/, "expenses", "expense"],
  [/existencia|inventario|mercaderia/, "inventory", "asset"],
];

export function accountingMetadata(value: string): AccountingMetadata {
  const name = normalizeAccountTerm(value);
  const matched = FAMILY_RULES.find(([pattern]) => pattern.test(name));
  const statementSection = matched?.[2] ?? "asset";
  const contraAccount =
    /depreciacion acumulada|amortizacion acumulada|\bmenos\b/.test(name);
  return {
    family: matched?.[1] ?? "other",
    statementSection,
    expectedBalanceNature:
      contraAccount ||
      statementSection === "liability" ||
      statementSection === "equity" ||
      statementSection === "income"
        ? "credit"
        : "debit",
    term: /corto plazo|corriente/.test(name)
      ? "current"
      : /largo plazo|no corriente/.test(name)
        ? "non_current"
        : undefined,
    contraAccount,
    concepts: [...relevantWords(name)].map(singularize),
  };
}

export function singularize(word: string): string {
  if (word.endsWith("es") && word.length > 5) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 4) return word.slice(0, -1);
  return word;
}

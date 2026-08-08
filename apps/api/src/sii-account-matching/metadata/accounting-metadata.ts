import {
  normalizeAccountTerm,
  relevantWords,
} from "../normalization/account-term-normalizer";
import type {
  AccountingMetadata,
  StatementSection,
} from "../account-matching.types";

const FAMILY_RULES: ReadonlyArray<[RegExp, string, StatementSection]> = [
  [
    /gastos? pagados? por anticipado|arriendo anticipado|seguro anticipado|seguros anticipados|comision anticipada|comisiones anticipadas|prepago|prepagado|pagado por adelantado/,
    "prepaid_expenses",
    "asset",
  ],
  [/depreciacion|amortizacion/, "depreciation", "asset"],
  [/deuda|obligacion|prestamo|leasing/, "financial_liabilities", "liability"],
  [/caja|banco|disponible|efectivo/, "cash", "asset"],
  [/cliente|deudor|cobrar/, "receivables", "asset"],
  [/maquinaria|equipo|vehiculo|inmueble|activo fijo/, "fixed_assets", "asset"],
  [/proveedor|pagar/, "payables", "liability"],
  [/iva|impuesto|ppm|retencion/, "taxes", "liability"],
  [
    /capital|patrimonio|utilidad acumulada|utilidades acumuladas|perdidas? acumuladas?|resultados? acumulados?|resultado acumulado/,
    "equity",
    "equity",
  ],
  [
    /^arriendo\b|arriendo fijo|gasto de arriendo|gastos de arriendo|arrendamiento operacional|canon de arrendamiento/,
    "expenses",
    "expense",
  ],
  [
    /gasto|costo|perdida|remuneracion|honorario|arriendo|arrendamiento|alquiler|electricidad|energia electrica|servicios basicos/,
    "expenses",
    "expense",
  ],
  [/^ventas?$|ingreso|ganancia/, "income", "income"],
  [/existencia|inventario|mercaderia/, "inventory", "asset"],
];

// "(menos)" is also used by the SII catalogue to present ordinary result
// accounts. It is therefore not, by itself, evidence of a contra account.
// Keep this list restricted to accounting descriptions whose complementary
// nature is explicit and verified.
const CONTRA_ACCOUNT_RULES: ReadonlyArray<RegExp> = [
  /depreciacion acumulada/,
  /depreciacion(?: \( menos \)| menos)/,
  /amortizacion acumulada/,
  /amortizacion(?: \( menos \)| menos)/,
  /deterioro acumulado/,
  /provision complementaria (?:de )?activo/,
  /provision (?:de )?deuda incobrable/,
  /provision incobrable/,
  /deuda incobrable/,
  /deudores incobrables/,
  /castigo de deudores/,
  /mayor valor (?:de )?inversiones?(?: \( menos \)| menos)/,
];

export function accountingMetadata(value: string): AccountingMetadata {
  const name = normalizeAccountTerm(value);
  const matched = FAMILY_RULES.find(([pattern]) => pattern.test(name));
  // Missing structured metadata must remain unknown. Treating every unknown
  // catalogue account as an asset made lexical matches operationally unsafe.
  const statementSection = matched?.[2] ?? "unknown";
  const contraAccount = CONTRA_ACCOUNT_RULES.some((pattern) =>
    pattern.test(name),
  );
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
    term: /\b(no corriente|no-corriente|largo plazo|\bnc\b|\blp\b)\b/.test(name)
      ? "non_current"
      : /cuenta corriente/.test(name)
        ? undefined
        : /\b(corto plazo|corriente)\b/.test(name)
          ? "current"
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

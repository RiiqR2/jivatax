import type { SiiAccountConceptType } from "../entities/sii-account-concept.entity";

export type DerivedConceptDefinition = {
  concept: string;
  type: SiiAccountConceptType;
  weight: number;
};

export type SiiAccountConceptRule = {
  matches: (normalizedName: string) => boolean;
  concepts: readonly DerivedConceptDefinition[];
};

const concept = (
  value: string,
  type: SiiAccountConceptType,
  weight: number,
): DerivedConceptDefinition => ({ concept: value, type, weight });

const section = (value: string, nature: "saldo deudor" | "saldo acreedor") => [
  concept(value, "statement_section", 55),
  concept(nature, "balance_nature", 50),
];

/** Conservative catalogue rules. Every match requires an accounting phrase. */
export const SII_ACCOUNT_CONCEPT_RULES: readonly SiiAccountConceptRule[] = [
  {
    matches: (name) => name.includes("circulante"),
    concepts: [concept("corto plazo", "temporal_classification", 55)],
  },
  {
    matches: (name) => name.includes("largo plazo"),
    concepts: [concept("largo plazo", "temporal_classification", 60)],
  },
  {
    matches: (name) => name.includes("depreciacion") && name.includes("menos"),
    concepts: [
      concept(
        "cuenta complementaria de activo",
        "contra_account_indicator",
        70,
      ),
      concept("saldo acreedor", "balance_nature", 60),
    ],
  },
  {
    matches: (name) => name.includes("amortizacion") && name.includes("menos"),
    concepts: [
      concept(
        "cuenta complementaria de activo",
        "contra_account_indicator",
        70,
      ),
      concept("saldo acreedor", "balance_nature", 60),
    ],
  },
  {
    matches: (name) => name.includes("obligaciones") && name.includes("bancos"),
    concepts: [
      concept("obligaciones financieras", "accounting_family", 65),
      ...section("pasivo", "saldo acreedor"),
    ],
  },
  {
    matches: (name) => name.includes("deudores") || name.includes("por cobrar"),
    concepts: [
      concept("cuentas por cobrar", "accounting_family", 65),
      ...section("activo", "saldo deudor"),
    ],
  },
  {
    matches: (name) => name.includes("por pagar"),
    concepts: section("pasivo", "saldo acreedor"),
  },
  {
    matches: (name) => name.includes("ventas"),
    concepts: section("ingreso", "saldo acreedor"),
  },
  {
    matches: (name) => name.includes("costo"),
    concepts: section("gasto", "saldo deudor"),
  },
  {
    matches: (name) => name.includes("gasto"),
    concepts: section("gasto", "saldo deudor"),
  },
  {
    matches: (name) =>
      name.includes("capital") || name.includes("utilidades acumuladas"),
    concepts: section("patrimonio", "saldo acreedor"),
  },
];

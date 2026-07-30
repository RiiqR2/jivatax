import type { SiiAccountConceptType } from "../entities/sii-account-concept.entity";

export type CuratedSiiAccountConcepts = {
  siiAccountCode: string;
  concepts: ReadonlyArray<{
    concept: string;
    type: SiiAccountConceptType;
    weight: number;
  }>;
};

const c = (concept: string, type: SiiAccountConceptType, weight: number) => ({
  concept,
  type,
  weight,
});

/** Codes verified against the catalogue knowledge already versioned in sii-account-aliases.ts. */
export const SII_ACCOUNT_CONCEPTS: readonly CuratedSiiAccountConcepts[] = [
  {
    siiAccountCode: "1.01.01.00",
    concepts: [
      c("liquidez", "economic_concept", 80),
      c("fondos líquidos", "economic_concept", 80),
      c("disponibilidad inmediata", "economic_concept", 90),
      c("activo circulante", "statement_section", 70),
      c("saldo deudor", "balance_nature", 60),
    ],
  },
  {
    siiAccountCode: "1.01.05.00",
    concepts: [
      c("cuentas por cobrar comerciales", "economic_concept", 90),
      c("crédito comercial", "economic_concept", 75),
      c("activo circulante", "statement_section", 70),
      c("saldo deudor", "balance_nature", 60),
    ],
  },
  {
    siiAccountCode: "1.01.08.00",
    concepts: [
      c("cuentas por cobrar documentadas", "economic_concept", 90),
      c("letras por cobrar", "economic_concept", 80),
      c("activo circulante", "statement_section", 70),
      c("saldo deudor", "balance_nature", 60),
    ],
  },
  {
    siiAccountCode: "1.02.03.00",
    concepts: [
      c("activo fijo", "accounting_family", 85),
      c("propiedad planta y equipo", "accounting_family", 90),
      c("bien depreciable", "economic_concept", 75),
      c("saldo deudor", "balance_nature", 60),
    ],
  },
  {
    siiAccountCode: "1.02.06.00",
    concepts: [
      c("cuenta complementaria de activo", "contra_account_indicator", 95),
      c("contra activo", "contra_account_indicator", 90),
      c("activo fijo", "accounting_family", 80),
      c("saldo acreedor", "balance_nature", 70),
      c("depreciación acumulada", "economic_concept", 95),
    ],
  },
];

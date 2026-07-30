import type { SiiAccountTermType } from "../entities/sii-account-term.entity";

export type CuratedSiiAccountKnowledge = {
  siiAccountCode: string;
  terms: ReadonlyArray<{
    term: string;
    type: Exclude<SiiAccountTermType, "official_name">;
    weight: number;
  }>;
};

/**
 * Reviewed aliases keyed only by stable SII code. Add entries after checking the
 * currently imported official catalogue; never use UUIDs or MiPyme codes here.
 */
export const SII_ACCOUNT_ALIASES: readonly CuratedSiiAccountKnowledge[] = [
  {
    siiAccountCode: "1.01.01.00",
    terms: [
      { term: "caja", type: "alias", weight: 60 },
      { term: "banco", type: "alias", weight: 55 },
      { term: "bancos", type: "alias", weight: 55 },
      { term: "cuenta corriente", type: "erp_term", weight: 50 },
      { term: "efectivo", type: "alias", weight: 55 },
      { term: "disponible", type: "alias", weight: 60 },
      { term: "deuda bancaria", type: "negative_term", weight: -50 },
      { term: "deudas con bancos", type: "negative_term", weight: -50 },
      { term: "préstamo bancario", type: "negative_term", weight: -40 },
      { term: "obligación bancaria", type: "negative_term", weight: -40 },
      { term: "pagar", type: "negative_term", weight: -35 },
      { term: "sobregiro", type: "negative_term", weight: -50 },
    ],
  },
  {
    siiAccountCode: "1.01.05.00",
    terms: [
      { term: "clientes", type: "erp_term", weight: 60 },
      { term: "deudores por venta", type: "alias", weight: 60 },
      { term: "clientes nacionales", type: "alias", weight: 60 },
      { term: "cuentas por cobrar clientes", type: "erp_term", weight: 55 },
      { term: "deudores comerciales", type: "alias", weight: 60 },
      {
        term: "cuentas por cobrar relacionadas",
        type: "negative_term",
        weight: -45,
      },
      { term: "documentos por cobrar", type: "negative_term", weight: -35 },
    ],
  },
  {
    siiAccountCode: "1.02.03.00",
    terms: [
      { term: "maquinarias y equipos", type: "erp_term", weight: 60 },
      { term: "maquinaria y equipos", type: "alias", weight: 60 },
      { term: "depreciación acumulada", type: "negative_term", weight: -60 },
    ],
  },
  {
    siiAccountCode: "1.02.06.00",
    terms: [
      {
        term: "dep acum maquinarias y equipos",
        type: "erp_term",
        weight: 60,
      },
      { term: "depreciación acumulada maquinaria", type: "alias", weight: 60 },
      { term: "depreciación acumulada maquinarias", type: "alias", weight: 60 },
      { term: "dep acumulada maquinaria", type: "abbreviation", weight: 50 },
      {
        term: "depreciación acumulada de maquinarias",
        type: "alias",
        weight: 60,
      },
      { term: "depreciación acumulada equipos", type: "alias", weight: 60 },
    ],
  },
];

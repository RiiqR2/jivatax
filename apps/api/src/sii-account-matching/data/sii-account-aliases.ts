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
      { term: "préstamo bancario", type: "negative_term", weight: -40 },
      { term: "obligación bancaria", type: "negative_term", weight: -40 },
    ],
  },
  {
    siiAccountCode: "1.01.04.00",
    terms: [{ term: "clientes", type: "erp_term", weight: 60 }],
  },
  {
    siiAccountCode: "1.01.08.00",
    terms: [
      { term: "iva crédito fiscal", type: "alias", weight: 60 },
      { term: "iva cf", type: "abbreviation", weight: 55 },
      { term: "ppm", type: "abbreviation", weight: 55 },
    ],
  },
  {
    siiAccountCode: "1.02.06.00",
    terms: [{ term: "maquinarias y equipos", type: "erp_term", weight: 60 }],
  },
  {
    siiAccountCode: "1.02.07.00",
    terms: [
      {
        term: "dep acum maquinarias y equipos",
        type: "erp_term",
        weight: 60,
      },
    ],
  },
];

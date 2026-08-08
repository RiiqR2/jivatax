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
  {
    siiAccountCode: "1.01.59.00",
    terms: [
      { term: "iva credito fiscal", type: "alias", weight: 60 },
      { term: "iva crédito fiscal", type: "alias", weight: 60 },
      { term: "iva debito fiscal", type: "negative_term", weight: -40 },
      { term: "iva débito fiscal", type: "negative_term", weight: -40 },
    ],
  },
  {
    siiAccountCode: "1.01.08.00",
    terms: [
      { term: "anticipo proveedores", type: "alias", weight: 60 },
      { term: "anticipos a proveedores", type: "alias", weight: 60 },
      { term: "anticipo a proveedores", type: "erp_term", weight: 60 },
    ],
  },
  {
    siiAccountCode: "1.01.12.00",
    terms: [
      { term: "pagos en transito", type: "alias", weight: 60 },
      { term: "pagos en tránsito", type: "alias", weight: 60 },
      { term: "existencias en transito", type: "negative_term", weight: -45 },
      { term: "existencias en tránsito", type: "negative_term", weight: -45 },
      { term: "pagos basados en acciones", type: "negative_term", weight: -50 },
    ],
  },
  {
    siiAccountCode: "1.01.15.00",
    terms: [
      { term: "honorarios diferidos", type: "alias", weight: 55 },
      { term: "gastos diferidos", type: "alias", weight: 60 },
      { term: "costos diferidos", type: "alias", weight: 55 },
      {
        term: "intereses diferidos leasing",
        type: "negative_term",
        weight: -45,
      },
    ],
  },
  {
    siiAccountCode: "1.01.11.00",
    terms: [
      { term: "gastos pagados por anticipado", type: "alias", weight: 60 },
      { term: "seguros anticipados", type: "alias", weight: 60 },
      { term: "comisiones anticipadas", type: "alias", weight: 60 },
      { term: "seguro anticipado", type: "alias", weight: 55 },
      { term: "comision anticipada", type: "alias", weight: 55 },
    ],
  },
  {
    siiAccountCode: "3.01.03.00",
    terms: [
      { term: "arriendo", type: "alias", weight: 65 },
      { term: "gasto de arriendo", type: "erp_term", weight: 62 },
      { term: "alquiler", type: "alias", weight: 60 },
      { term: "arrendamiento", type: "industry_term", weight: 60 },
      { term: "renta de local", type: "industry_term", weight: 58 },
      { term: "honorarios", type: "alias", weight: 65 },
      { term: "gastos de honorarios", type: "erp_term", weight: 65 },
      { term: "honorarios profesionales", type: "industry_term", weight: 62 },
      { term: "servicios profesionales", type: "industry_term", weight: 60 },
      { term: "asesorias profesionales", type: "industry_term", weight: 58 },
      { term: "electricidad", type: "alias", weight: 65 },
      { term: "energia electrica", type: "industry_term", weight: 62 },
      { term: "consumo electrico", type: "erp_term", weight: 60 },
      { term: "gasto de electricidad", type: "erp_term", weight: 62 },
      { term: "luz", type: "alias", weight: 58 },
      { term: "servicios basicos", type: "industry_term", weight: 60 },
    ],
  },
];

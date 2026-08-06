import type { StatementSection } from "../account-matching.types";

/**
 * Families needed by pipeline v2. `metadataFamily` documents their relationship
 * with the broader, existing `accountingMetadata` taxonomy. Matching rules live
 * here so classification and resolution cannot drift independently.
 */
export const PIPELINE_ACCOUNT_FAMILIES = {
  cash: {
    observed: /caja|banco|disponible|pagos en transito/,
    destination: /^(disponible|efectivo y equivalentes)/,
    metadataFamily: "cash",
    section: "asset",
  },
  vat_credit: {
    observed: /iva credito fiscal/,
    destination: /iva credito fiscal/,
    metadataFamily: "taxes",
    section: "asset",
  },
  vat_debit: {
    observed: /iva debito fiscal/,
    destination: /iva debito fiscal/,
    metadataFamily: "taxes",
    section: "liability",
  },
  supplier_advance: {
    observed: /anticipo.*proveedor/,
    destination: /anticipo(?:s)? a proveedores/,
    metadataFamily: "receivables",
    section: "asset",
  },
  customer_advance: {
    observed: /anticipo.*cliente|ingreso.*percibido.*adelantado/,
    metadataFamily: "payables",
    section: "liability",
  },
  trade_payable: {
    observed: /proveedor/,
    destination: /proveedores por pagar/,
    metadataFamily: "payables",
    section: "liability",
  },
  bank_debt: {
    observed: /obligacion.*banc|prestamo banc/,
    destination: /obligaciones? (?:con )?banc|prestamos? bancarios?/,
    metadataFamily: "financial_liabilities",
    section: "liability",
  },
  issued_capital: {
    observed: /capital emitido/,
    destination: /capital emitido/,
    metadataFamily: "equity",
    section: "equity",
  },
  loan_receivable: {
    observed: /prestamo.*por cobrar/,
    metadataFamily: "receivables",
    section: "asset",
  },
  loan_payable: {
    observed: /prestamo.*por pagar/,
    metadataFamily: "financial_liabilities",
    section: "liability",
  },
  lease_liability: {
    observed: /pasivo.*arrendamiento/,
    metadataFamily: "financial_liabilities",
    section: "liability",
  },
  bad_debt_allowance: {
    observed:
      /provision.*(?:deuda|deudor|cuenta).*incobrable|deterioro.*(?:cliente|deudor)/,
    metadataFamily: "receivables",
    section: "contra_asset",
  },
} as const satisfies Record<
  string,
  {
    observed: RegExp;
    destination?: RegExp;
    metadataFamily: string;
    section: StatementSection | "contra_asset";
  }
>;

export type PipelineAccountFamily =
  keyof typeof PIPELINE_ACCOUNT_FAMILIES | "unknown";

const FAMILY_CLASSIFICATION_ORDER: Exclude<PipelineAccountFamily, "unknown">[] =
  [
    "vat_credit",
    "vat_debit",
    "supplier_advance",
    "customer_advance",
    "loan_payable",
    "lease_liability",
    "bank_debt",
    "issued_capital",
    "loan_receivable",
    "bad_debt_allowance",
    "trade_payable",
    "cash",
  ];

export function classifyPipelineAccountFamily(
  normalizedName: string,
): PipelineAccountFamily {
  return (
    FAMILY_CLASSIFICATION_ORDER.find((family) =>
      PIPELINE_ACCOUNT_FAMILIES[family].observed.test(normalizedName),
    ) ?? "unknown"
  );
}

export function pipelineFamilyDestination(
  family: PipelineAccountFamily,
): RegExp | undefined {
  if (family === "unknown") return undefined;
  const definition = PIPELINE_ACCOUNT_FAMILIES[family];
  return "destination" in definition ? definition.destination : undefined;
}

import { TaxDocumentType } from "../enums/accounting.enums";

export type DocumentContract = {
  title: string;
  required: Record<string, string[]>;
  optional: string[];
};

export const DOCUMENT_CONTRACTS: Record<TaxDocumentType, DocumentContract> = {
  [TaxDocumentType.BALANCE]: {
    title: "Balance de ocho columnas",
    required: {
      accountCode: [
        "codigo cuenta",
        "cuenta",
        "codigo",
        "cod cuenta",
        "nro cuenta",
        "numero cuenta",
        "id cuenta",
        "codigo de cuenta",
      ],
      accountName: [
        "nombre cuenta",
        "nombre de cuenta",
        "nombre",
        "glosa",
        "descripcion",
        "glosa cuenta",
      ],
      debits: [
        "debitos",
        "debe",
        "debe movimientos",
        "movimiento debe",
        "total debe",
      ],
      credits: [
        "creditos",
        "haber",
        "haber movimientos",
        "movimiento haber",
        "total haber",
      ],
      debitBalance: ["saldo deudor", "deudor", "saldo debe"],
      creditBalance: ["saldo acreedor", "acreedor", "saldo haber"],
      assets: ["activos", "activo", "inventario activo"],
      liabilities: ["pasivos", "pasivo", "inventario pasivo"],
      losses: ["perdida", "perdidas", "resultado perdida"],
      gains: ["ganancia", "ganancias", "resultado ganancia"],
    },
    optional: [
      "Código padre",
      "Nivel",
      "Centro de costo",
      "Moneda",
      "Observación",
    ],
  },
  [TaxDocumentType.GENERAL_LEDGER]: {
    title: "Libro Mayor",
    required: {
      accountCode: ["codigo cuenta", "cuenta", "codigo"],
      accountName: [
        "nombre cuenta",
        "nombre de cuenta",
        "nombre",
        "glosa cuenta",
      ],
      date: ["fecha", "fecha movimiento", "fecha contable"],
      documentType: ["tipo documento", "tipo doc", "documento tipo"],
      documentNumber: [
        "numero documento",
        "nro documento",
        "folio",
        "documento",
      ],
      description: ["glosa", "descripcion", "detalle", "concepto"],
      debit: ["debe", "debito", "cargo"],
      credit: ["haber", "credito", "abono"],
    },
    optional: [
      "Saldo deudor",
      "Saldo acreedor",
      "Centro de costo",
      "Código auxiliar",
      "RUT contraparte",
      "Número comprobante",
      "Moneda",
      "Tipo de cambio",
    ],
  },
  [TaxDocumentType.JOURNAL]: {
    title: "Libro Diario",
    required: {
      date: ["fecha", "f comp", "fecha comprobante", "fecha contable"],
      voucherNumber: [
        "numero comprobante",
        "comprobante",
        "numero",
        "nro comprobante",
      ],
      sequence: ["secuencia", "linea", "numero linea"],
      accountCode: ["cuenta", "codigo cuenta"],
      debit: ["debe", "debito"],
      credit: ["haber", "credito"],
      description: ["glosa", "concepto", "descripcion", "detalle"],
    },
    optional: [
      "Nombre cuenta",
      "Tipo documento",
      "Número documento",
      "RUT contraparte",
      "Nombre contraparte",
      "Código auxiliar",
      "Centro de costo",
      "Libro",
      "Moneda",
      "Tipo de cambio",
      "Fecha documento",
      "Fecha vencimiento",
      "Monto neto",
      "Monto exento",
      "IVA",
      "IVA activo fijo",
      "Código impuesto adicional",
      "Tasa impuesto adicional",
      "Monto impuesto adicional",
      "Asiento apertura",
      "Indicador activo fijo",
    ],
  },
};

export function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[_-]+/g, " ");
}

export function resolveRequiredHeaders(
  headers: unknown[],
  contract: DocumentContract,
) {
  const normalized = headers.map(normalizeHeader);
  const map: Record<string, number> = {};
  const duplicates: Array<{ field: string; columns: number[] }> = [];
  const missingFields: string[] = [];
  for (const [field, aliases] of Object.entries(contract.required)) {
    const accepted = new Set(aliases.map(normalizeHeader));
    const columns = normalized.flatMap((header, index) =>
      accepted.has(header) ? [index] : [],
    );
    if (columns.length === 0) missingFields.push(field);
    else {
      map[field] = columns[0];
      if (columns.length > 1) duplicates.push({ field, columns });
    }
  }
  return { map, duplicates, missingFields };
}

export type TaxPeriod = {
  id: string;
  companyId: string;
  commercialYear: number;
  taxYear: number;
  status: "open" | "processing" | "reviewed" | "closed";
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export type TaxDocumentType = "balance" | "general_ledger" | "journal";

export type TaxDocument = {
  id: string;
  documentType: TaxDocumentType;
  status: string;
  versionNumber: number;
  uploadedAt: string;
  uploadedByUserId: string;
  storedFile: { id: string; originalName: string; sizeBytes: string };
  metadata: TaxDocumentReport | null;
};

export type TaxDocumentReport = {
  rowsRead?: number;
  validRows?: number;
  ignoredRows?: number;
  errors?: unknown[];
  warnings?: unknown[];
  totals?: Record<string, unknown>;
  reconciliation?: Record<string, unknown>;
};

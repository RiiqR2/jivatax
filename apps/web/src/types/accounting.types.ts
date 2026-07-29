export type TaxPeriod = {
  id: string;
  companyId: string;
  commercialYear: number;
  taxYear: number;
  status: "open" | "processing" | "reviewed" | "closed";
  startDate: string;
  endDate: string;
};

export type TaxDocumentType = "balance" | "general_ledger" | "journal";

export type TaxDocument = {
  id: string;
  documentType: TaxDocumentType;
  status: string;
  versionNumber: number;
  uploadedAt: string;
  storedFile: { id: string; originalName: string; sizeBytes: string };
  metadata: {
    rowsRead?: number;
    validRows?: number;
    errors?: unknown[];
    warnings?: unknown[];
  } | null;
};

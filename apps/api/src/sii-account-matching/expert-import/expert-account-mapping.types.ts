export const expertImportReasonCodes = [
  "MISSING_INTERNAL_NAME",
  "MISSING_SII_CODE",
  "SII_ACCOUNT_NOT_FOUND",
  "DUPLICATE_EXPERT_CONFIRMATION",
  "INVALID_INDUSTRY",
  "INVALID_CONFIRMED_BY_USER",
  "EMPTY_NORMALIZED_NAME",
  "SII_CODE_NOT_UNIQUE",
  "UNEXPECTED_ROW_ERROR",
] as const;
export type ExpertImportReasonCode = (typeof expertImportReasonCodes)[number];
export interface ExpertMappingRow {
  rowNumber: number;
  internalAccountCode: string | null;
  originalName: string;
  siiCode: string;
}
export interface ExpertImportRejection extends ExpertMappingRow {
  reasonCode: ExpertImportReasonCode;
  message: string;
}
export interface ExpertImportReport {
  file: string;
  sheet: string;
  fileHash: string;
  datasetIdentifier: string;
  totalRows: number;
  validRows: number;
  importedRows: number;
  duplicateRows: number;
  rejectedRows: number;
  unresolvedSiiCodes: string[];
  invalidNames: number;
  invalidIndustry: boolean;
  dryRun: boolean;
  aggregatesRebuilt: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  rejections: ExpertImportRejection[];
}

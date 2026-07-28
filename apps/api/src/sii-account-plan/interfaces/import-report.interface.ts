export interface SiiAccountPlanImportReport {
  file: string;
  checksum: string;
  sheets: string[];
  selectedSheet: string;
  headerRowNumber: number;
  rowsRead: number;
  validRows: number;
  ignoredRows: number;
  errors: string[];
  warnings: string[];
  duplicateCodes: string[];
  missingParents: string[];
  accountsToImport: number;
  dryRun: boolean;
  alreadyImported: boolean;
  versionId: string | null;
}

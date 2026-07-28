export interface RawCompanyAccountRow {
  sourceRowNumber: number;
  values: unknown[];
  rawData: Record<string, unknown>;
}

export interface DetectedAccountPlanColumns {
  code: number;
  name: number;
  description: number | null;
  level: number | null;
  parentCode: number | null;
  status: number | null;
}

export interface NormalizedCompanyAccountRow {
  internalCode: string;
  name: string;
  description: string | null;
  level: number | null;
  parentCode: string | null;
  sourceRowNumber: number;
  rawData: Record<string, unknown>;
}

export interface ValidatedCompanyAccountRow extends NormalizedCompanyAccountRow {
  sortOrder: number;
}

export interface CompanyAccountPlanImportReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  ignoredRows: number;
  ambiguousMappings: number;
  errors: string[];
}

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
  status: "active" | "inactive" | null;
  levelIsValid: boolean;
  statusIsValid: boolean;
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
  errors: AccountPlanValidationError[];
}

export type AccountPlanValidationErrorCode =
  | "MISSING_REQUIRED_COLUMN"
  | "AMBIGUOUS_COLUMN"
  | "EMPTY_CODE"
  | "EMPTY_NAME"
  | "DUPLICATE_CODE"
  | "INVALID_LEVEL"
  | "INVALID_STATUS"
  | "PARENT_NOT_FOUND"
  | "SELF_PARENT"
  | "TOO_MANY_ROWS"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE";

export interface AccountPlanValidationError {
  row: number;
  column: string;
  code: AccountPlanValidationErrorCode;
  message: string;
}

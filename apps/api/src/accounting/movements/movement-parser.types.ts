export type MovementIssue = {
  sourceRowNumber: number;
  field: string;
  code: string;
  message: string;
  rawValue: unknown;
};

export type MovementPeriod = {
  commercialYear: number;
  startDate: string;
  endDate: string;
};

export type MovementParserContext = {
  matrix: unknown[][];
  headerRow: number;
  columns: Record<string, number>;
  sheetName: string;
  period: MovementPeriod;
};

export type MovementParseResult = {
  rows: Record<string, unknown>[];
  errors: MovementIssue[];
  warnings: MovementIssue[];
  ignoredRows: number;
  totals: { debit: number; credit: number };
  details: Record<string, unknown>;
};

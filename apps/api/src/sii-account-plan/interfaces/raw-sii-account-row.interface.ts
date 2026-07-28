export type SpreadsheetCellValue = string | number | boolean | null;

export interface RawSiiAccountRow {
  sourceRowNumber: number;
  cells: SpreadsheetCellValue[];
  sourceColumns: Record<string, SpreadsheetCellValue>;
}

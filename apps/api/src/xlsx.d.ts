declare module "xlsx" {
  export interface WorkSheet {
    "!ref"?: string;
    [key: string]: unknown;
  }

  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }

  export interface CellObject {
    t: string;
    v: string | number;
    z?: string;
  }

  export function read(
    data: Buffer,
    options: Record<string, unknown>,
  ): WorkBook;

  export function write(
    workbook: WorkBook,
    options: Record<string, unknown>,
  ): Buffer | string;

  export const utils: {
    sheet_to_json<T>(sheet: WorkSheet, options: Record<string, unknown>): T[];
    aoa_to_sheet(rows: unknown[][]): WorkSheet;
    book_new(): WorkBook;
    book_append_sheet(workbook: WorkBook, sheet: WorkSheet, name: string): void;
  };

  export const SSF: {
    parse_date_code(value: number): { y: number; m: number; d: number } | null;
  };
}

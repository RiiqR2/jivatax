declare module "xlsx" {
  export interface WorkSheet {
    "!ref"?: string;
    [key: string]: unknown;
  }

  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }

  export function read(
    data: Buffer,
    options: Record<string, unknown>,
  ): WorkBook;

  export const utils: {
    sheet_to_json<T>(sheet: WorkSheet, options: Record<string, unknown>): T[];
  };
}

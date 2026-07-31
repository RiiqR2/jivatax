import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { createRequire } from "node:module";
import type {
  RawSiiAccountRow,
  SpreadsheetCellValue,
} from "../interfaces/raw-sii-account-row.interface";

const requirePackage = createRequire(__filename);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const DEFAULT_SHEET = "ANEXO N°1 (DDJJ 1847 y 1926)";
const ACCOUNT_CODE = /^\d+\.\d{2}\.\d{2}\.\d{2}$/;

type Sheet = Record<string, unknown>;
interface Workbook {
  SheetNames: string[];
  Sheets: Record<string, Sheet>;
}
interface XlsxLibrary {
  read(data: Buffer, options: Record<string, unknown>): Workbook;
  utils: {
    sheet_to_json<T>(sheet: Sheet, options: Record<string, unknown>): T[];
  };
}

export interface ReadWorkbookResult {
  workbook: Workbook;
  sheets: string[];
  checksumInput: Buffer;
}

export interface DetectedSheet {
  name: string;
  rows: SpreadsheetCellValue[][];
  headerRowIndex: number;
}

function loadXlsx(): XlsxLibrary {
  return requirePackage("xlsx") as XlsxLibrary;
}

export async function readWorkbook(file: string): Promise<ReadWorkbookResult> {
  if (![".xls", ".xlsx"].includes(extname(file).toLowerCase())) {
    throw new Error("El archivo debe tener extensión .xls o .xlsx.");
  }
  const fileStat = await stat(file);
  if (fileStat.size === 0 || fileStat.size > MAX_FILE_SIZE) {
    throw new Error("El archivo está vacío o supera el límite de 20 MiB.");
  }
  const data = await readFile(file);
  const workbook = loadXlsx().read(data, {
    type: "buffer",
    cellFormula: false,
    cellHTML: false,
    cellStyles: false,
    raw: false,
  });
  if (workbook.SheetNames.length === 0) {
    throw new Error("El libro no contiene hojas.");
  }
  return { workbook, sheets: workbook.SheetNames, checksumInput: data };
}

export function detectSheet(
  result: ReadWorkbookResult,
  requestedSheet = DEFAULT_SHEET,
): DetectedSheet {
  if (requestedSheet === "F1926") {
    throw new Error("La hoja F1926 es visual y no se puede importar.");
  }
  const worksheet = result.workbook.Sheets[requestedSheet];
  if (!worksheet) {
    throw new Error(`No existe la hoja solicitada: ${requestedSheet}.`);
  }
  const rows = loadXlsx().utils.sheet_to_json<SpreadsheetCellValue[]>(
    worksheet,
    { header: 1, defval: null, raw: false, blankrows: true },
  );
  return { name: requestedSheet, rows, headerRowIndex: -1 };
}

export function parseRows(sheet: DetectedSheet): RawSiiAccountRow[] {
  return sheet.rows.map((cells, index) => {
    const codeIndex = cells.findIndex((cell) =>
      ACCOUNT_CODE.test(String(cell ?? "").trim()),
    );
    const code = codeIndex >= 0 ? String(cells[codeIndex]).trim() : null;
    const description =
      codeIndex >= 0
        ? (cells
            .slice(codeIndex + 1)
            .find((cell) => Boolean(String(cell ?? "").trim())) ?? null)
        : null;
    return {
      sourceRowNumber: index + 1,
      cells,
      sourceColumns: { codigo: code, descripcion: description },
    };
  });
}

export const spreadsheetHeaders = {
  code: ["codigo"],
  name: ["descripcion"],
};

export { ACCOUNT_CODE, DEFAULT_SHEET };

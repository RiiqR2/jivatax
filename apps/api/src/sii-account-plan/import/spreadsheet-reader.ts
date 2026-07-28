import { readFile, stat } from "node:fs/promises";
import { extname } from "node:path";
import { createRequire } from "node:module";
import type {
  RawSiiAccountRow,
  SpreadsheetCellValue,
} from "../interfaces/raw-sii-account-row.interface";

const requirePackage = createRequire(__filename);
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const OLE_SIGNATURE = "d0cf11e0a1b11ae1";
const CODE_HEADERS = ["codigo", "código", "cod cuenta", "codigo cuenta"];
const NAME_HEADERS = [
  "descripcion",
  "descripción",
  "nombre",
  "nombre cuenta",
  "glosa",
];

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
  // Loaded only by the backend CLI. SheetJS reads cached cell values and does not
  // execute VBA macros or spreadsheet formulas.
  return requirePackage("xlsx") as XlsxLibrary;
}

function normalizeHeader(value: SpreadsheetCellValue): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("es-CL")
    .replace(/\s+/g, " ");
}

function isHeader(row: SpreadsheetCellValue[]): boolean {
  const headers = row.map(normalizeHeader);
  return (
    headers.some((header) => CODE_HEADERS.includes(header)) &&
    headers.some((header) => NAME_HEADERS.includes(header))
  );
}

export async function readWorkbook(file: string): Promise<ReadWorkbookResult> {
  if (extname(file).toLowerCase() !== ".xls") {
    throw new Error("El archivo debe tener extensión .xls.");
  }

  const fileStat = await stat(file);
  if (fileStat.size === 0) {
    throw new Error("El archivo está vacío.");
  }
  if (fileStat.size > MAX_FILE_SIZE) {
    throw new Error("El archivo supera el límite de 20 MiB.");
  }

  const data = await readFile(file);
  if (data.subarray(0, 8).toString("hex") !== OLE_SIGNATURE) {
    throw new Error("La firma del archivo no corresponde a un XLS legado.");
  }

  const workbook = loadXlsx().read(data, {
    type: "buffer",
    cellFormula: false,
    cellHTML: false,
    cellNF: false,
    cellStyles: false,
    raw: false,
  });

  if (workbook.SheetNames.length === 0) {
    throw new Error("El libro no contiene hojas.");
  }

  return {
    workbook,
    sheets: workbook.SheetNames,
    checksumInput: data,
  };
}

export function detectSheet(result: ReadWorkbookResult): DetectedSheet {
  const candidates = result.sheets.flatMap((name) => {
    const rows = loadXlsx().utils.sheet_to_json<SpreadsheetCellValue[]>(
      result.workbook.Sheets[name],
      {
        header: 1,
        defval: null,
        raw: false,
        blankrows: true,
      },
    );
    const headerRowIndex = rows.findIndex(isHeader);
    return headerRowIndex < 0
      ? []
      : [
          {
            name,
            rows,
            headerRowIndex,
          },
        ];
  });

  if (candidates.length === 0) {
    throw new Error(
      "No se encontró una fila de encabezado con código y descripción/nombre.",
    );
  }
  if (candidates.length > 1) {
    throw new Error(
      `Se encontraron múltiples hojas candidatas: ${candidates
        .map((candidate) => candidate.name)
        .join(", ")}.`,
    );
  }

  return candidates[0];
}

export function parseRows(sheet: DetectedSheet): RawSiiAccountRow[] {
  const headers = sheet.rows[sheet.headerRowIndex].map((cell, index) => {
    const normalized = normalizeHeader(cell);
    return normalized || `column_${index + 1}`;
  });

  return sheet.rows.slice(sheet.headerRowIndex + 1).map((cells, index) => ({
    sourceRowNumber: sheet.headerRowIndex + index + 2,
    cells,
    sourceColumns: Object.fromEntries(
      headers.map((header, columnIndex) => [
        header,
        cells[columnIndex] ?? null,
      ]),
    ),
  }));
}

export const spreadsheetHeaders = {
  code: CODE_HEADERS,
  name: NAME_HEADERS,
};

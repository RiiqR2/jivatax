import type { NormalizedSiiAccountRow } from "../interfaces/normalized-sii-account-row.interface";
import type {
  RawSiiAccountRow,
  SpreadsheetCellValue,
} from "../interfaces/raw-sii-account-row.interface";
import { spreadsheetHeaders } from "./spreadsheet-reader";

const DESCRIPTION_HEADERS = ["detalle", "observacion", "observación"];
const LEVEL_HEADERS = ["nivel"];

function normalizeText(value: SpreadsheetCellValue): string | null {
  if (value === null) {
    return null;
  }
  const normalized = String(value).trim().replace(/\s+/g, " ");
  return normalized || null;
}

function valueFor(
  row: RawSiiAccountRow,
  aliases: string[],
): SpreadsheetCellValue {
  const key = Object.keys(row.sourceColumns).find((header) =>
    aliases.includes(header),
  );
  return key ? row.sourceColumns[key] : null;
}

export function normalizeRows(
  rows: RawSiiAccountRow[],
): NormalizedSiiAccountRow[] {
  return rows
    .filter((row) => row.cells.some((cell) => normalizeText(cell) !== null))
    .map((row) => {
      const levelValue = normalizeText(valueFor(row, LEVEL_HEADERS));
      const parsedLevel = levelValue ? Number(levelValue) : null;
      return {
        sourceRowNumber: row.sourceRowNumber,
        code: normalizeText(valueFor(row, spreadsheetHeaders.code)),
        name: normalizeText(valueFor(row, spreadsheetHeaders.name)),
        description: normalizeText(valueFor(row, DESCRIPTION_HEADERS)),
        level:
          parsedLevel !== null && Number.isInteger(parsedLevel)
            ? parsedLevel
            : null,
        sourceColumns: Object.fromEntries(
          Object.entries(row.sourceColumns).map(([key, value]) => [
            key,
            normalizeText(value),
          ]),
        ),
      };
    });
}

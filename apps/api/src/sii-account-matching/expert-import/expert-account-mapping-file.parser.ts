import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { createRequire } from "node:module";
import type { ExpertMappingRow } from "./expert-account-mapping.types";
import type * as Xlsx from "xlsx";

const requirePackage = createRequire(__filename);
const NAME = [
  "nombre_cuenta",
  "nombre cuenta",
  "cuenta",
  "descripcion",
  "descripción",
  "internal_name",
  "account_name",
];
const INTERNAL_CODE = [
  "codigo_cuenta",
  "código cuenta",
  "codigo interno",
  "código interno",
  "internal_code",
  "account_code",
];
const SII_CODE = [
  "codigo_sii",
  "código sii",
  "cuenta_sii",
  "cuenta sii",
  "sii_code",
  "sii_account_code",
];
const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, " ");
const normalized = (aliases: string[]) => aliases.map(normalizeHeader);

export interface ParsedExpertMappingFile {
  sheet: string;
  bytes: Buffer;
  rows: ExpertMappingRow[];
}
export class ExpertAccountMappingFileParser {
  async parse(
    file: string,
    requestedSheet?: string,
  ): Promise<ParsedExpertMappingFile> {
    if (![".xlsx", ".xls"].includes(extname(file).toLowerCase()))
      throw new Error("Formato no soportado; use .xlsx o .xls.");
    const bytes = await readFile(file);
    if (!bytes.length) throw new Error("El archivo está vacío.");
    const xlsx = requirePackage("xlsx") as typeof Xlsx;
    const workbook = xlsx.read(bytes, {
      type: "buffer",
      raw: false,
      cellFormula: false,
    });
    const sheet = requestedSheet ?? workbook.SheetNames[0];
    if (!sheet || !workbook.Sheets[sheet])
      throw new Error(`La hoja '${requestedSheet ?? ""}' no existe.`);
    const matrix = xlsx.utils.sheet_to_json(workbook.Sheets[sheet], {
      header: 1,
      defval: "",
      raw: false,
      blankrows: false,
    }) as unknown[][];
    if (!matrix.length) throw new Error("La hoja está vacía.");
    const headers = matrix[0].map(normalizeHeader);
    const find = (aliases: string[]) =>
      headers.findIndex((h) => normalized(aliases).includes(h));
    const nameIndex = find(NAME);
    const siiIndex = find(SII_CODE);
    const internalIndex = find(INTERNAL_CODE);
    if (nameIndex < 0 || siiIndex < 0)
      throw new Error(
        "Faltan encabezados requeridos: nombre de cuenta interna y código SII.",
      );
    const text = (value: unknown) => String(value ?? "").trim();
    const rows = matrix
      .slice(1)
      .map((row, index) => ({
        rowNumber: index + 2,
        internalAccountCode:
          internalIndex < 0 ? null : text(row[internalIndex]) || null,
        originalName: text(row[nameIndex]),
        siiCode: text(row[siiIndex]),
      }))
      .filter(
        (row) => row.originalName || row.siiCode || row.internalAccountCode,
      );
    if (!rows.length) throw new Error("La hoja no contiene filas de datos.");
    return { sheet, bytes, rows };
  }
}
export const expertMappingHeaderAliases = {
  internalName: NAME,
  internalCode: INTERNAL_CODE,
  siiCode: SII_CODE,
};

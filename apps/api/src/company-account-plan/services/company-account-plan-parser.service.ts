import { BadRequestException, Injectable } from "@nestjs/common";
import * as XLSX from "xlsx";
import type {
  CompanyAccountPlanImportReport,
  DetectedAccountPlanColumns,
  NormalizedCompanyAccountRow,
  RawCompanyAccountRow,
  ValidatedCompanyAccountRow,
} from "../interfaces/company-account-import.interface";

const HEADER_ALIASES = {
  code: ["codigo", "cod cuenta", "cuenta", "codigo cuenta", "account code"],
  name: [
    "nombre",
    "descripcion",
    "nombre cuenta",
    "cuenta contable",
    "glosa",
    "account name",
  ],
  description: ["detalle", "descripcion cuenta", "description"],
  level: ["nivel", "level"],
  parentCode: ["codigo padre", "cuenta padre", "parent code"],
  status: ["estado", "status"],
} as const;

@Injectable()
export class CompanyAccountPlanParserService {
  inspectFile(buffer: Buffer, extension: string): XLSX.WorkBook {
    if (!["xlsx", "xls", "csv"].includes(extension)) {
      throw new BadRequestException(
        "Formato no soportado. Usa XLSX, XLS o CSV.",
      );
    }
    try {
      return XLSX.read(buffer, {
        type: "buffer",
        raw: true,
        cellText: true,
      });
    } catch {
      throw new BadRequestException("No fue posible leer el archivo.");
    }
  }

  detectSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
    const name = workbook.SheetNames.find((sheetName) => {
      const range = workbook.Sheets[sheetName]?.["!ref"];
      return Boolean(range && range !== "A1:A1");
    });
    if (!name) {
      throw new BadRequestException("El archivo no contiene una hoja válida.");
    }
    return workbook.Sheets[name];
  }

  detectHeaderRow(rows: unknown[][]): number {
    const maximumRows = Math.min(rows.length, 30);
    for (let index = 0; index < maximumRows; index += 1) {
      const normalized = rows[index].map((value) =>
        this.normalizeHeader(value),
      );
      const hasCode = normalized.some((value) =>
        HEADER_ALIASES.code.includes(value as never),
      );
      const hasName = normalized.some((value) =>
        HEADER_ALIASES.name.includes(value as never),
      );
      if (hasCode && hasName) {
        return index;
      }
    }
    throw new BadRequestException(
      "No se detectó una fila de encabezados con código y nombre.",
    );
  }

  detectColumns(headers: unknown[]): DetectedAccountPlanColumns {
    const normalized = headers.map((value) => this.normalizeHeader(value));
    const find = (aliases: readonly string[]): number | null => {
      const index = normalized.findIndex((value) => aliases.includes(value));
      return index < 0 ? null : index;
    };
    const code = find(HEADER_ALIASES.code);
    const name = find(HEADER_ALIASES.name);
    if (code === null || name === null || code === name) {
      throw new BadRequestException(
        "No fue posible detectar columnas distintas para código y nombre.",
      );
    }
    return {
      code,
      name,
      description: find(HEADER_ALIASES.description),
      level: find(HEADER_ALIASES.level),
      parentCode: find(HEADER_ALIASES.parentCode),
      status: find(HEADER_ALIASES.status),
    };
  }

  parseRows(sheet: XLSX.WorkSheet, headerRow: number): RawCompanyAccountRow[] {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
    const headers = rows[headerRow].map((value) => String(value).trim());
    return rows.slice(headerRow + 1).map((values, index) => ({
      sourceRowNumber: headerRow + index + 2,
      values,
      rawData: Object.fromEntries(
        headers.map((header, column) => [
          header || `column_${column + 1}`,
          values[column] ?? "",
        ]),
      ),
    }));
  }

  normalizeRows(
    rows: RawCompanyAccountRow[],
    columns: DetectedAccountPlanColumns,
  ): NormalizedCompanyAccountRow[] {
    return rows
      .filter((row) => !this.isIgnoredRow(row, columns))
      .map((row) => ({
        internalCode: String(row.values[columns.code] ?? "").trim(),
        name: String(row.values[columns.name] ?? "")
          .trim()
          .replace(/\s+/g, " "),
        description: this.optionalString(row.values[columns.description ?? -1]),
        level: this.optionalLevel(row.values[columns.level ?? -1]),
        parentCode: this.optionalString(row.values[columns.parentCode ?? -1]),
        sourceRowNumber: row.sourceRowNumber,
        rawData: row.rawData,
      }));
  }

  validateRows(rows: NormalizedCompanyAccountRow[]): {
    rows: ValidatedCompanyAccountRow[];
    report: CompanyAccountPlanImportReport;
  } {
    if (rows.length > 20_000) {
      throw new BadRequestException(
        "El archivo supera el máximo de 20.000 cuentas.",
      );
    }
    const errors: string[] = [];
    const codes = new Set<string>();
    rows.forEach((row) => {
      if (!row.internalCode || row.internalCode.length > 100) {
        errors.push(
          `Fila ${row.sourceRowNumber}: código requerido o demasiado largo.`,
        );
      }
      if (!row.name || row.name.length > 255) {
        errors.push(
          `Fila ${row.sourceRowNumber}: nombre requerido o demasiado largo.`,
        );
      }
      if (codes.has(row.internalCode)) {
        errors.push(
          `Fila ${row.sourceRowNumber}: código duplicado ${row.internalCode}.`,
        );
      }
      codes.add(row.internalCode);
    });
    if (!rows.length) {
      errors.push("El archivo no contiene cuentas.");
    }
    if (errors.length) {
      throw new BadRequestException({
        message: "El plan de cuentas contiene errores críticos.",
        errors,
      });
    }
    return {
      rows: rows.map((row, index) => ({
        internalCode: row.internalCode,
        name: row.name,
        description: row.description,
        level: row.level,
        parentCode: row.parentCode,
        sourceRowNumber: row.sourceRowNumber,
        rawData: row.rawData,
        sortOrder: index,
      })),
      report: {
        totalRows: rows.length,
        validRows: rows.length,
        invalidRows: 0,
        ignoredRows: 0,
        ambiguousMappings: 0,
        errors: [],
      },
    };
  }

  resolveHierarchy(
    rows: ValidatedCompanyAccountRow[],
  ): ValidatedCompanyAccountRow[] {
    return rows;
  }

  private normalizeHeader(value: unknown): string {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  private optionalString(value: unknown): string | null {
    const normalized = String(value ?? "").trim();
    return normalized || null;
  }

  private optionalLevel(value: unknown): number | null {
    const normalized = String(value ?? "").trim();
    if (!/^\d+$/.test(normalized)) {
      return null;
    }
    const level = Number(normalized);
    return level <= 65_535 ? level : null;
  }

  private isIgnoredRow(
    row: RawCompanyAccountRow,
    columns: DetectedAccountPlanColumns,
  ): boolean {
    const values = row.values.map((value) => String(value ?? "").trim());
    if (values.every((value) => !value)) {
      return true;
    }
    const code = this.normalizeHeader(row.values[columns.code]);
    const name = this.normalizeHeader(row.values[columns.name]);
    if (
      HEADER_ALIASES.code.includes(code as never) &&
      HEADER_ALIASES.name.includes(name as never)
    ) {
      return true;
    }
    return ["total", "totales", "nota", "notas"].includes(code);
  }
}

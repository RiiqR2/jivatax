import { BadRequestException, Injectable } from "@nestjs/common";
import * as XLSX from "xlsx";
import {
  ACCOUNT_PLAN_ERROR_LIMIT,
  ACCOUNT_PLAN_FILE_CONTRACT,
  type AccountPlanColumnKey,
} from "../company-account-plan.contract";
import type {
  AccountPlanValidationError,
  CompanyAccountPlanImportReport,
  DetectedAccountPlanColumns,
  NormalizedCompanyAccountRow,
  RawCompanyAccountRow,
  ValidatedCompanyAccountRow,
} from "../interfaces/company-account-import.interface";

@Injectable()
export class CompanyAccountPlanParserService {
  inspectFile(buffer: Buffer, extension: string): XLSX.WorkBook {
    if (
      !ACCOUNT_PLAN_FILE_CONTRACT.allowedExtensions.includes(
        extension as "xlsx" | "xls" | "csv",
      )
    ) {
      this.throwValidation([
        {
          row: 0,
          column: "Archivo",
          code: "UNSUPPORTED_FILE_TYPE",
          message: "Formato no soportado. Usa XLSX, XLS o CSV.",
        },
      ]);
    }
    try {
      return XLSX.read(buffer, {
        type: "buffer",
        raw: true,
        cellText: true,
      });
    } catch {
      throw new BadRequestException({
        status: "failed",
        message: "No fue posible leer el archivo.",
        errors: [],
      });
    }
  }

  detectSheet(workbook: XLSX.WorkBook): XLSX.WorkSheet {
    const name = workbook.SheetNames.find((sheetName) => {
      const range = workbook.Sheets[sheetName]?.["!ref"];
      return Boolean(
        range &&
        range !== "A1:A1" &&
        sheetName !== ACCOUNT_PLAN_FILE_CONTRACT.instructionsSheetName,
      );
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
      if (
        this.matchesColumn(normalized, "code") &&
        this.matchesColumn(normalized, "name")
      ) {
        return index;
      }
    }
    this.throwValidation([
      {
        row: 1,
        column: "Código, Nombre",
        code: "MISSING_REQUIRED_COLUMN",
        message:
          "No se detectaron las columnas obligatorias Código y Nombre. Usa la plantilla oficial.",
      },
    ]);
  }

  detectColumns(headers: unknown[]): DetectedAccountPlanColumns {
    const normalized = headers.map((value) => this.normalizeHeader(value));
    const detected = new Map<AccountPlanColumnKey, number>();
    const errors: AccountPlanValidationError[] = [];

    for (const column of ACCOUNT_PLAN_FILE_CONTRACT.columns) {
      const canonicalHeader = this.normalizeHeader(column.header);
      const canonicalMatches = normalized
        .map((header, index) => (header === canonicalHeader ? index : -1))
        .filter((index) => index >= 0);
      const aliases = column.aliases.map((alias) =>
        this.normalizeHeader(alias),
      );
      const matches = normalized
        .map((header, index) => (aliases.includes(header) ? index : -1))
        .filter((index) => index >= 0);
      const selectedMatches = canonicalMatches.length
        ? canonicalMatches
        : matches;

      if (selectedMatches.length > 1) {
        errors.push({
          row: 1,
          column: column.header,
          code: "AMBIGUOUS_COLUMN",
          message: `Se detectaron varias columnas para ${column.header}: ${selectedMatches
            .map((index) => String(headers[index]))
            .join(", ")}. Usa la plantilla oficial.`,
        });
      } else if (selectedMatches.length === 1) {
        detected.set(column.key, selectedMatches[0]);
      } else if (column.required) {
        errors.push({
          row: 1,
          column: column.header,
          code: "MISSING_REQUIRED_COLUMN",
          message: `Falta la columna obligatoria ${column.header}.`,
        });
      }
    }

    const code = detected.get("code");
    const name = detected.get("name");
    if (code !== undefined && name !== undefined && code === name) {
      errors.push({
        row: 1,
        column: "Código, Nombre",
        code: "AMBIGUOUS_COLUMN",
        message: "Código y Nombre no pueden corresponder a la misma columna.",
      });
    }
    if (errors.length) {
      this.throwValidation(errors);
    }

    return {
      code: code as number,
      name: name as number,
      description: detected.get("description") ?? null,
      level: detected.get("level") ?? null,
      parentCode: detected.get("parentCode") ?? null,
      status: detected.get("status") ?? null,
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
      .map((row) => {
        const level = this.normalizeLevel(row.values[columns.level ?? -1]);
        const status = this.normalizeStatus(row.values[columns.status ?? -1]);
        return {
          internalCode: String(row.values[columns.code] ?? "").trim(),
          name: String(row.values[columns.name] ?? "")
            .trim()
            .replace(/\s+/g, " "),
          description: this.optionalString(
            row.values[columns.description ?? -1],
          ),
          level: level.value,
          levelIsValid: level.valid,
          parentCode: this.optionalString(row.values[columns.parentCode ?? -1]),
          status: status.value,
          statusIsValid: status.valid,
          sourceRowNumber: row.sourceRowNumber,
          rawData: row.rawData,
        };
      });
  }

  validateRows(rows: NormalizedCompanyAccountRow[]): {
    rows: ValidatedCompanyAccountRow[];
    report: CompanyAccountPlanImportReport;
  } {
    const errors: AccountPlanValidationError[] = [];
    const codes = new Set<string>();
    const invalidRowNumbers = new Set<number>();

    if (rows.length > ACCOUNT_PLAN_FILE_CONTRACT.maximumRows) {
      errors.push({
        row: 0,
        column: "Archivo",
        code: "TOO_MANY_ROWS",
        message: `El archivo supera el máximo de ${ACCOUNT_PLAN_FILE_CONTRACT.maximumRows.toLocaleString("es-CL")} cuentas.`,
      });
    }

    for (const row of rows) {
      const rowErrors = this.validateRow(row, codes);
      if (rowErrors.length) {
        invalidRowNumbers.add(row.sourceRowNumber);
        errors.push(...rowErrors);
      }
      if (row.internalCode) {
        codes.add(row.internalCode);
      }
    }

    for (const row of rows) {
      if (row.parentCode && row.parentCode === row.internalCode) {
        invalidRowNumbers.add(row.sourceRowNumber);
        errors.push({
          row: row.sourceRowNumber,
          column: "Código padre",
          code: "SELF_PARENT",
          message: "Una cuenta no puede ser su propio padre.",
        });
      } else if (row.parentCode && !codes.has(row.parentCode)) {
        invalidRowNumbers.add(row.sourceRowNumber);
        errors.push({
          row: row.sourceRowNumber,
          column: "Código padre",
          code: "PARENT_NOT_FOUND",
          message: `El código padre ${row.parentCode} no existe en el archivo.`,
        });
      }
    }

    if (!rows.length) {
      errors.push({
        row: 0,
        column: "Archivo",
        code: "EMPTY_CODE",
        message: "El archivo no contiene cuentas.",
      });
    }
    if (errors.length) {
      this.throwValidation(errors, rows.length, invalidRowNumbers.size);
    }

    return {
      rows: rows.map((row, index) => ({
        internalCode: row.internalCode,
        name: row.name,
        description: row.description,
        level: row.level,
        parentCode: row.parentCode,
        status: row.status ?? "active",
        levelIsValid: row.levelIsValid,
        statusIsValid: row.statusIsValid,
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

  private validateRow(
    row: NormalizedCompanyAccountRow,
    codes: Set<string>,
  ): AccountPlanValidationError[] {
    const errors: AccountPlanValidationError[] = [];
    if (!row.internalCode) {
      errors.push({
        row: row.sourceRowNumber,
        column: "Código",
        code: "EMPTY_CODE",
        message: "El código es obligatorio.",
      });
    } else if (row.internalCode.length > 100) {
      errors.push({
        row: row.sourceRowNumber,
        column: "Código",
        code: "EMPTY_CODE",
        message: "El código no puede superar 100 caracteres.",
      });
    } else if (codes.has(row.internalCode)) {
      errors.push({
        row: row.sourceRowNumber,
        column: "Código",
        code: "DUPLICATE_CODE",
        message: `El código ${row.internalCode} está repetido.`,
      });
    }
    if (!row.name || row.name.length > 255) {
      errors.push({
        row: row.sourceRowNumber,
        column: "Nombre",
        code: "EMPTY_NAME",
        message: !row.name
          ? "El nombre es obligatorio."
          : "El nombre no puede superar 255 caracteres.",
      });
    }
    if (!row.levelIsValid) {
      errors.push({
        row: row.sourceRowNumber,
        column: "Nivel",
        code: "INVALID_LEVEL",
        message: "El nivel debe ser un entero positivo.",
      });
    }
    if (!row.statusIsValid) {
      errors.push({
        row: row.sourceRowNumber,
        column: "Estado",
        code: "INVALID_STATUS",
        message: "El estado debe ser active, inactive, activo o inactivo.",
      });
    }
    return errors;
  }

  private throwValidation(
    errors: AccountPlanValidationError[],
    totalRows = 0,
    invalidRows = 0,
  ): never {
    throw new BadRequestException({
      status: "failed",
      summary: {
        totalRows,
        validRows: Math.max(totalRows - invalidRows, 0),
        invalidRows,
      },
      errors: errors.slice(0, ACCOUNT_PLAN_ERROR_LIMIT),
      truncated: errors.length > ACCOUNT_PLAN_ERROR_LIMIT,
    });
  }

  private matchesColumn(headers: string[], key: AccountPlanColumnKey): boolean {
    const column = ACCOUNT_PLAN_FILE_CONTRACT.columns.find(
      (candidate) => candidate.key === key,
    );
    if (!column) {
      return false;
    }
    const aliases = [column.header, ...column.aliases].map((alias) =>
      this.normalizeHeader(alias),
    );
    return headers.some((header) => aliases.includes(header));
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

  private normalizeLevel(value: unknown): {
    value: number | null;
    valid: boolean;
  } {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
      return {
        value: null,
        valid: true,
      };
    }
    if (!/^\d+$/.test(normalized)) {
      return {
        value: null,
        valid: false,
      };
    }
    const level = Number(normalized);
    return {
      value: level,
      valid: level > 0 && level <= 65_535,
    };
  }

  private normalizeStatus(value: unknown): {
    value: "active" | "inactive" | null;
    valid: boolean;
  } {
    const normalized = this.normalizeHeader(value);
    if (!normalized) {
      return {
        value: null,
        valid: true,
      };
    }
    if (normalized === "active" || normalized === "activo") {
      return {
        value: "active",
        valid: true,
      };
    }
    if (normalized === "inactive" || normalized === "inactivo") {
      return {
        value: "inactive",
        valid: true,
      };
    }
    return {
      value: null,
      valid: false,
    };
  }

  private isIgnoredRow(
    row: RawCompanyAccountRow,
    _columns: DetectedAccountPlanColumns,
  ): boolean {
    const values = row.values.map((value) => String(value ?? "").trim());
    return values.every((value) => !value);
  }
}

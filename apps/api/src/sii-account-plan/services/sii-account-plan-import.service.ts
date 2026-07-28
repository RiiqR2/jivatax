import { createHash } from "node:crypto";
import { basename } from "node:path";
import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { SiiAccountEntity } from "../entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../entities/sii-account-plan-version.entity";
import { SiiAccountPlanVersionStatus } from "../enums/sii-account-plan-version-status.enum";
import { resolveHierarchy } from "../import/account-hierarchy-resolver";
import { normalizeRows } from "../import/account-row-normalizer";
import { validateRows } from "../import/account-row-validator";
import {
  detectSheet,
  parseRows,
  readWorkbook,
} from "../import/spreadsheet-reader";
import type { SiiAccountPlanImportReport } from "../interfaces/import-report.interface";
import type { ValidatedSiiAccountRow } from "../interfaces/normalized-sii-account-row.interface";

export interface ImportSiiAccountPlanOptions {
  file: string;
  code: string;
  name: string;
  sourceReference?: string;
  dryRun: boolean;
}

@Injectable()
export class SiiAccountPlanImportService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async import(
    options: ImportSiiAccountPlanOptions,
  ): Promise<SiiAccountPlanImportReport> {
    const workbookResult = await readWorkbook(options.file);
    const checksum = createHash("sha256")
      .update(workbookResult.checksumInput)
      .digest("hex");
    const sheet = detectSheet(workbookResult);
    const rawRows = parseRows(sheet);
    const normalizedRows = normalizeRows(rawRows);
    const validation = validateRows(normalizedRows);
    const hierarchy = resolveHierarchy(validation.rows);
    const existing = await this.dataSource
      .getRepository(SiiAccountPlanVersionEntity)
      .findOne({
        where: {
          sourceChecksum: checksum,
        },
      });

    const report: SiiAccountPlanImportReport = {
      file: basename(options.file),
      checksum,
      sheets: workbookResult.sheets,
      selectedSheet: sheet.name,
      headerRowNumber: sheet.headerRowIndex + 1,
      rowsRead: rawRows.length,
      validRows: hierarchy.rows.length,
      ignoredRows: validation.ignoredRows,
      errors: validation.errors,
      warnings: [...validation.warnings, ...hierarchy.warnings],
      duplicateCodes: validation.duplicateCodes,
      missingParents: hierarchy.missingParents,
      accountsToImport: hierarchy.rows.length,
      dryRun: options.dryRun,
      alreadyImported: existing !== null,
      versionId: existing?.id ?? null,
    };

    if (existing || options.dryRun) {
      return report;
    }
    if (report.errors.length > 0) {
      throw new Error(`Importación inválida: ${report.errors.join(" ")}`);
    }
    if (hierarchy.rows.length === 0) {
      throw new Error("El archivo no contiene cuentas válidas.");
    }

    report.versionId = await this.persistRows(
      options,
      checksum,
      hierarchy.rows,
    );
    return report;
  }

  private async persistRows(
    options: ImportSiiAccountPlanOptions,
    checksum: string,
    rows: ValidatedSiiAccountRow[],
  ): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const duplicateChecksum = await manager.findOne(
        SiiAccountPlanVersionEntity,
        {
          where: {
            sourceChecksum: checksum,
          },
        },
      );
      if (duplicateChecksum) {
        return duplicateChecksum.id;
      }

      const version = await manager.save(
        manager.create(SiiAccountPlanVersionEntity, {
          code: options.code,
          name: options.name,
          sourceFileName: basename(options.file),
          sourceReference: options.sourceReference ?? null,
          sourceChecksum: checksum,
          effectiveFrom: null,
          effectiveTo: null,
          status: SiiAccountPlanVersionStatus.DRAFT,
          importedAt: new Date(),
        }),
      );
      const idsByCode = new Map<string, string>();

      for (const row of rows) {
        const account = await manager.save(
          manager.create(SiiAccountEntity, {
            versionId: version.id,
            code: row.code,
            name: row.name,
            description: row.description,
            level: row.level,
            parentId: row.parentCode
              ? (idsByCode.get(row.parentCode) ?? null)
              : null,
            sortOrder: row.sortOrder,
            sourceRowNumber: row.sourceRowNumber,
            rawData: {
              sourceColumns: row.sourceColumns,
            },
          }),
        );
        idsByCode.set(row.code, account.id);
      }

      return version.id;
    });
  }
}

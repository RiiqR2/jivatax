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
  sheet?: string;
  code?: string;
  name?: string;
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
    const sheet = detectSheet(workbookResult, options.sheet);
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
    const previousActive = await this.dataSource
      .getRepository(SiiAccountPlanVersionEntity)
      .findOne({
        where: { status: SiiAccountPlanVersionStatus.ACTIVE },
      });
    const sectionCount = (prefix: string) =>
      hierarchy.rows.filter((row) => row.code.startsWith(prefix)).length;

    const report: SiiAccountPlanImportReport = {
      file: basename(options.file),
      checksum,
      sheets: workbookResult.sheets,
      selectedSheet: sheet.name,
      headerRowNumber: 0,
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
      previousActiveVersionId: previousActive?.id ?? null,
      activated:
        existing?.status === SiiAccountPlanVersionStatus.ACTIVE &&
        !options.dryRun,
      sections: {
        balanceAssets: sectionCount("1."),
        balanceLiabilitiesAndEquity: sectionCount("2."),
        incomeStatement: sectionCount("3."),
        taxAdjustment: sectionCount("5."),
      },
    };

    if (report.errors.length > 0) {
      throw new Error(`Importación inválida: ${report.errors.join(" ")}`);
    }
    if (hierarchy.rows.length === 0) {
      throw new Error("El archivo no contiene cuentas válidas.");
    }

    this.assertOfficialCatalog(hierarchy.rows);

    if (existing || options.dryRun) {
      return report;
    }

    report.versionId = await this.persistRows(
      options,
      checksum,
      hierarchy.rows,
    );
    report.activated = true;
    return report;
  }

  private assertOfficialCatalog(rows: ValidatedSiiAccountRow[]): void {
    const codes = new Set(rows.map((row) => row.code));
    const controls = [
      "1.01.01.00",
      "1.01.25.00",
      "1.01.59.00",
      "2.01.10.00",
      "2.03.06.00",
      "3.01.01.00",
      "3.05.15.00",
      "3.06.01.00",
      "5.01.05.06",
      "5.03.05.02",
      "5.04.01.01",
    ];
    const missing = controls.filter((code) => !codes.has(code));
    for (const prefix of ["1.", "2.", "3.", "5."]) {
      if (![...codes].some((code) => code.startsWith(prefix))) {
        missing.push(`${prefix}*`);
      }
    }
    if (missing.length > 0) {
      throw new Error(`Catálogo incompleto; faltan: ${missing.join(", ")}.`);
    }
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
          code: options.code ?? `sii-${checksum.slice(0, 12)}`,
          name: options.name ?? "Anexo DJ 1847 y DJ 1926",
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
            parentId: null,
            sortOrder: row.sortOrder,
            sourceRowNumber: row.sourceRowNumber,
            rawData: {
              sourceColumns: row.sourceColumns,
            },
          }),
        );
        idsByCode.set(row.code, account.id);
      }

      for (const row of rows) {
        if (row.parentCode) {
          await manager.update(
            SiiAccountEntity,
            { id: idsByCode.get(row.code) },
            { parentId: idsByCode.get(row.parentCode) ?? null },
          );
        }
      }

      await manager.update(
        SiiAccountPlanVersionEntity,
        { status: SiiAccountPlanVersionStatus.ACTIVE },
        { status: SiiAccountPlanVersionStatus.ARCHIVED },
      );
      version.status = SiiAccountPlanVersionStatus.ACTIVE;
      await manager.save(version);

      return version.id;
    });
  }
}

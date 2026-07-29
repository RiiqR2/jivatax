import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import * as XLSX from "xlsx";
import { DataSource, EntityManager, Repository } from "typeorm";
import { StoredFileEntity } from "../../files/entities/stored-file.entity";
import {
  OBJECT_STORAGE,
  ObjectStorageService,
} from "../../files/storage/object-storage.service";
import {
  DOCUMENT_CONTRACTS,
  normalizeHeader,
} from "../contracts/document-contracts";
import { CreateTaxDocumentDto } from "../dto/accounting.dto";
import { TaxDocumentEntity } from "../entities/tax-document.entity";
import { TaxDocumentStatus, TaxDocumentType } from "../enums/accounting.enums";
import { TaxPeriodsService } from "./tax-periods.service";

type Issue = {
  sourceRowNumber: number;
  field: string;
  code: string;
  message: string;
  rawValue: unknown;
};

type ImportReport = {
  rowsRead: number;
  validRows: number;
  ignoredRows: number;
  errors: Issue[];
  warnings: Issue[];
  totals: { debit: number; credit: number };
  reconciliation: Record<string, unknown>;
  detectedSheet: string;
  headerRowNumber: number;
  duplicateKeys: unknown[];
  detectedColumns: Record<string, number>;
};

@Injectable()
export class TaxDocumentsService {
  private readonly logger = new Logger(TaxDocumentsService.name);
  constructor(
    @InjectRepository(TaxDocumentEntity)
    private readonly documents: Repository<TaxDocumentEntity>,
    @InjectRepository(StoredFileEntity)
    private readonly files: Repository<StoredFileEntity>,
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorageService,
    private readonly periods: TaxPeriodsService,
  ) {}

  async list(
    companyId: string,
    periodId: string,
  ): Promise<TaxDocumentEntity[]> {
    await this.periods.get(companyId, periodId);
    return this.documents.find({
      where: { companyId, taxPeriodId: periodId },
      relations: { storedFile: true },
      order: { uploadedAt: "DESC" },
    });
  }

  async get(
    companyId: string,
    periodId: string,
    id: string,
  ): Promise<TaxDocumentEntity> {
    await this.periods.get(companyId, periodId);
    const document = await this.documents.findOne({
      where: { id, companyId, taxPeriodId: periodId },
      relations: { storedFile: true },
    });
    if (!document)
      throw new NotFoundException("Documento tributario no encontrado.");
    return document;
  }

  async create(
    companyId: string,
    periodId: string,
    userId: string,
    dto: CreateTaxDocumentDto,
  ): Promise<TaxDocumentEntity> {
    await this.periods.get(companyId, periodId);
    const file = await this.files.findOneBy({
      id: dto.storedFileId,
      companyId,
    });
    if (!file)
      throw new BadRequestException("El archivo no pertenece a la empresa.");
    if (!["xls", "xlsx", "csv"].includes(file.extension.toLowerCase()))
      throw new BadRequestException("Formato de archivo no soportado.");
    const latest = await this.documents.findOne({
      where: {
        companyId,
        taxPeriodId: periodId,
        documentType: dto.documentType,
      },
      order: { versionNumber: "DESC" },
    });
    return this.documents.save(
      this.documents.create({
        companyId,
        taxPeriodId: periodId,
        storedFileId: file.id,
        documentType: dto.documentType,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        uploadedByUserId: userId,
        uploadedAt: new Date(),
        replacesDocumentId: null,
      }),
    );
  }

  async process(
    companyId: string,
    periodId: string,
    id: string,
    sheetName?: string,
  ): Promise<Record<string, unknown>> {
    const started = Date.now();
    const document = await this.get(companyId, periodId, id);
    document.status = TaxDocumentStatus.PROCESSING;
    await this.documents.save(document);
    this.logger.log(
      JSON.stringify({
        event: "accounting_processing_started",
        documentId: id,
        companyId,
        taxPeriodId: periodId,
      }),
    );
    try {
      const buffer = await this.storage.getObject(
        document.storedFile.bucket,
        document.storedFile.objectKey,
      );
      const workbook = XLSX.read(buffer, {
        type: "buffer",
        cellDates: true,
        raw: true,
      });
      const parsed = this.parse(workbook, document.documentType, sheetName);
      if (parsed.report.errors.length > 0) {
        document.status = TaxDocumentStatus.INVALID;
        document.validatedAt = new Date();
        document.errorSummary = `${parsed.report.errors.length} errores de validación`;
        document.metadata = parsed.report;
        await this.documents.save(document);
        return parsed.report;
      }
      await this.persist(document, parsed.rows, parsed.report);
      this.logger.log(
        JSON.stringify({
          event: "accounting_processing_finished",
          documentId: id,
          companyId,
          taxPeriodId: periodId,
          rowsRead: parsed.report.rowsRead,
          validRows: parsed.report.validRows,
          durationMs: Date.now() - started,
        }),
      );
      return parsed.report;
    } catch (error) {
      document.status = TaxDocumentStatus.PROCESSING_ERROR;
      document.errorSummary =
        error instanceof Error ? error.message : "Error de procesamiento";
      await this.documents.save(document);
      this.logger.error(
        JSON.stringify({
          event: "accounting_processing_rollback",
          documentId: id,
          companyId,
          taxPeriodId: periodId,
          durationMs: Date.now() - started,
        }),
      );
      throw error;
    }
  }

  report(companyId: string, periodId: string, id: string) {
    return this.get(companyId, periodId, id).then(
      (document) => document.metadata ?? {},
    );
  }

  private parse(
    workbook: XLSX.WorkBook,
    type: TaxDocumentType,
    requestedSheet?: string,
  ) {
    const contract = DOCUMENT_CONTRACTS[type];
    const candidates: Array<{
      sheet: string;
      row: number;
      map: Record<string, number>;
      matrix: unknown[][];
    }> = [];
    for (const sheet of workbook.SheetNames) {
      if (requestedSheet && sheet !== requestedSheet) continue;
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(
        workbook.Sheets[sheet],
        { header: 1, raw: true, defval: null },
      );
      for (let row = 0; row < Math.min(matrix.length, 25); row += 1) {
        const normalized = matrix[row].map(normalizeHeader);
        const map: Record<string, number> = {};
        for (const [field, aliases] of Object.entries(contract.required)) {
          const index = normalized.findIndex((header) =>
            aliases.map(normalizeHeader).includes(header),
          );
          if (index >= 0) map[field] = index;
        }
        if (Object.keys(map).length === Object.keys(contract.required).length)
          candidates.push({ sheet, row, map, matrix });
      }
    }
    if (candidates.length !== 1)
      throw new BadRequestException(
        candidates.length > 1
          ? "MULTIPLE_SHEETS: selecciona una hoja candidata."
          : "UNSUPPORTED_HEADER: faltan columnas requeridas.",
      );
    const candidate = candidates[0];
    const errors: Issue[] = [];
    const warnings: Issue[] = [];
    const rows: Record<string, unknown>[] = [];
    const seen = new Map<string, string>();
    candidate.matrix.slice(candidate.row + 1).forEach((source, offset) => {
      if (
        source.every((value) => value === null || String(value).trim() === "")
      )
        return;
      const row: Record<string, unknown> = {};
      for (const [field, index] of Object.entries(candidate.map))
        row[field] = source[index];
      const sourceRowNumber = candidate.row + offset + 2;
      row.sourceRowNumber = sourceRowNumber;
      row.rawData = source;
      for (const field of Object.keys(contract.required))
        if (row[field] === null || String(row[field]).trim() === "")
          errors.push({
            sourceRowNumber,
            field,
            code: "REQUIRED_FIELD",
            message: "Campo obligatorio vacío.",
            rawValue: row[field],
          });
      if (row.accountCode !== undefined) {
        row.accountCode = String(row.accountCode).trim();
        const signature = JSON.stringify(row);
        if (seen.has(String(row.accountCode)))
          errors.push({
            sourceRowNumber,
            field: "accountCode",
            code: "DUPLICATE_ACCOUNT",
            message:
              seen.get(String(row.accountCode)) === signature
                ? "Cuenta duplicada."
                : "Cuenta duplicada con valores diferentes.",
            rawValue: row.accountCode,
          });
        seen.set(String(row.accountCode), signature);
      }
      for (const field of [
        "debits",
        "credits",
        "debitBalance",
        "creditBalance",
        "assets",
        "liabilities",
        "losses",
        "gains",
        "debit",
        "credit",
      ]) {
        if (!(field in row)) continue;
        const value =
          row[field] === null || row[field] === "" ? 0 : Number(row[field]);
        if (!Number.isFinite(value) || value < 0)
          errors.push({
            sourceRowNumber,
            field,
            code: "INVALID_NUMBER",
            message: "Debe ser un monto no negativo.",
            rawValue: row[field],
          });
        row[field] = value;
      }
      if (Number(row.debit ?? 0) > 0 && Number(row.credit ?? 0) > 0)
        errors.push({
          sourceRowNumber,
          field: "debit",
          code: "BOTH_DEBIT_AND_CREDIT",
          message: "Debe y Haber no pueden ser positivos simultáneamente.",
          rawValue: null,
        });
      rows.push(row);
    });
    const totals = rows.reduce<{ debit: number; credit: number }>(
      (sum, row) => ({
        debit: sum.debit + Number(row.debits ?? row.debit ?? 0),
        credit: sum.credit + Number(row.credits ?? row.credit ?? 0),
      }),
      { debit: 0, credit: 0 },
    );
    if (
      type === TaxDocumentType.BALANCE &&
      Math.abs(totals.debit - totals.credit) > 1
    )
      warnings.push({
        sourceRowNumber: 0,
        field: "totals",
        code: "BALANCE_NOT_RECONCILED",
        message: "La suma de débitos y créditos no cuadra.",
        rawValue: totals,
      });
    return {
      rows,
      report: {
        rowsRead: rows.length,
        validRows:
          rows.length -
          new Set(errors.map((issue) => issue.sourceRowNumber)).size,
        ignoredRows: candidate.matrix.length - candidate.row - 1 - rows.length,
        errors,
        warnings,
        totals,
        reconciliation: {},
        detectedSheet: candidate.sheet,
        headerRowNumber: candidate.row + 1,
        duplicateKeys: errors
          .filter((issue) => issue.code.startsWith("DUPLICATE"))
          .map((issue) => issue.rawValue),
        detectedColumns: candidate.map,
      },
    };
  }

  private async persist(
    document: TaxDocumentEntity,
    rows: Record<string, unknown>[],
    report: ImportReport,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const importId = randomUUID();
      const table =
        document.documentType === TaxDocumentType.BALANCE
          ? "balance_imports"
          : document.documentType === TaxDocumentType.GENERAL_LEDGER
            ? "general_ledger_imports"
            : "journal_imports";
      await manager.query(
        `INSERT INTO ${table} (id, tax_document_id, company_id, tax_period_id, rows_read, valid_rows, ignored_rows, total_debit, total_credit, validation_report, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), NOW(6))`,
        [
          importId,
          document.id,
          document.companyId,
          document.taxPeriodId,
          report.rowsRead,
          report.validRows,
          report.ignoredRows,
          report.totals.debit,
          report.totals.credit,
          JSON.stringify(report),
        ],
      );
      if (document.documentType === TaxDocumentType.BALANCE)
        await this.persistBalance(manager, document, importId, rows, report);
      document.status = TaxDocumentStatus.PROCESSED;
      document.validatedAt = new Date();
      document.processedAt = new Date();
      document.metadata = report;
      await manager.save(document);
      const previous = await manager.findOne(TaxDocumentEntity, {
        where: {
          companyId: document.companyId,
          taxPeriodId: document.taxPeriodId,
          documentType: document.documentType,
          status: TaxDocumentStatus.PROCESSED,
        },
        order: { versionNumber: "DESC" },
      });
      if (previous && previous.id !== document.id) {
        document.replacesDocumentId = previous.id;
        previous.status = TaxDocumentStatus.SUPERSEDED;
        await manager.save(previous);
        await manager.save(document);
      }
    });
  }

  private async persistBalance(
    manager: EntityManager,
    document: TaxDocumentEntity,
    importId: string,
    rows: Record<string, unknown>[],
    report: ImportReport,
  ): Promise<void> {
    for (const row of rows) {
      const entryId = randomUUID();
      await manager.query(
        "INSERT INTO balance_entries (id, balance_import_id, company_id, tax_period_id, account_code, account_name, debits, credits, debit_balance, credit_balance, assets, liabilities, losses, gains, source_row_number, raw_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), NOW(6))",
        [
          entryId,
          importId,
          document.companyId,
          document.taxPeriodId,
          row.accountCode,
          String(row.accountName).trim().replace(/\s+/g, " "),
          row.debits,
          row.credits,
          row.debitBalance,
          row.creditBalance,
          row.assets,
          row.liabilities,
          row.losses,
          row.gains,
          row.sourceRowNumber,
          JSON.stringify(row.rawData),
        ],
      );
      const existing = (
        await manager.query(
          "SELECT id, name FROM company_accounts WHERE company_id = ? AND internal_code = ? AND deleted_at IS NULL LIMIT 1",
          [document.companyId, row.accountCode],
        )
      )[0];
      let accountId = existing?.id;
      if (!accountId) {
        accountId = randomUUID();
        await manager.query(
          "INSERT INTO company_accounts (id, company_id, internal_code, name, status, sort_order, source_row_number, first_seen_tax_period_id, last_seen_tax_period_id, first_seen_at, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', 0, ?, ?, ?, NOW(6), NOW(6), NOW(6), NOW(6))",
          [
            accountId,
            document.companyId,
            row.accountCode,
            String(row.accountName).trim(),
            row.sourceRowNumber,
            document.taxPeriodId,
            document.taxPeriodId,
          ],
        );
        await manager.query(
          "INSERT INTO company_account_mappings (id, company_account_id, status, mapping_method, created_at, updated_at) VALUES (?, ?, 'pending', 'automatic', NOW(6), NOW(6))",
          [randomUUID(), accountId],
        );
      } else {
        await manager.query(
          "UPDATE company_accounts SET last_seen_tax_period_id = ?, last_seen_at = NOW(6), updated_at = NOW(6) WHERE id = ?",
          [document.taxPeriodId, accountId],
        );
        if (
          existing.name.trim().replace(/\s+/g, " ") !==
          String(row.accountName).trim().replace(/\s+/g, " ")
        )
          report.warnings.push({
            sourceRowNumber: Number(row.sourceRowNumber),
            field: "accountName",
            code: "ACCOUNT_NAME_CHANGED",
            message: "El nombre importado difiere del nombre canónico.",
            rawValue: {
              accountCode: row.accountCode,
              existingName: existing.name,
              importedName: row.accountName,
            },
          });
      }
      await manager.query(
        "INSERT INTO tax_period_company_accounts (id, company_id, tax_period_id, company_account_id, source_document_id, balance_entry_id, account_code_snapshot, account_name_snapshot, debit_amount, credit_amount, debit_balance, credit_balance, asset_amount, liability_amount, loss_amount, gain_amount, first_seen_at, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), NOW(6), NOW(6), NOW(6)) ON DUPLICATE KEY UPDATE source_document_id=VALUES(source_document_id), balance_entry_id=VALUES(balance_entry_id), account_name_snapshot=VALUES(account_name_snapshot), debit_amount=VALUES(debit_amount), credit_amount=VALUES(credit_amount), debit_balance=VALUES(debit_balance), credit_balance=VALUES(credit_balance), asset_amount=VALUES(asset_amount), liability_amount=VALUES(liability_amount), loss_amount=VALUES(loss_amount), gain_amount=VALUES(gain_amount), last_seen_at=NOW(6), updated_at=NOW(6)",
        [
          randomUUID(),
          document.companyId,
          document.taxPeriodId,
          accountId,
          document.id,
          entryId,
          row.accountCode,
          row.accountName,
          row.debits,
          row.credits,
          row.debitBalance,
          row.creditBalance,
          row.assets,
          row.liabilities,
          row.losses,
          row.gains,
        ],
      );
    }
  }
}

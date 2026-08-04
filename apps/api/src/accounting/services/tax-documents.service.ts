import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import * as XLSX from "xlsx";
import {
  DataSource,
  EntityManager,
  IsNull,
  LessThan,
  Repository,
} from "typeorm";
import { StoredFileEntity } from "../../files/entities/stored-file.entity";
import {
  OBJECT_STORAGE,
  ObjectStorageService,
} from "../../files/storage/object-storage.service";
import {
  DOCUMENT_CONTRACTS,
  resolveRequiredHeaders,
} from "../contracts/document-contracts";
import { CreateTaxDocumentDto } from "../dto/accounting.dto";
import { TaxDocumentEntity } from "../entities/tax-document.entity";
import {
  CompanyAccountSuggestionEntity,
  CompanyAccountSuggestionStatus,
} from "../entities/company-account-suggestion.entity";
import {
  BalanceRole,
  TaxDocumentStatus,
  TaxDocumentType,
} from "../enums/accounting.enums";
import {
  BALANCE_MONETARY_FIELDS,
  BalanceParsedRow,
  BalanceRowType,
  normalizeSummaryLabel,
  parseBalanceRows,
  reportedSummaryType,
} from "../balance/balance-parser";
import { TaxPeriodsService } from "./tax-periods.service";
import { TaxPeriodEntity } from "../entities/tax-period.entity";
import { parseGeneralLedger } from "../movements/general-ledger-parser";
import { parseJournal } from "../movements/journal-parser";

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
  totals: { debit: number | string; credit: number | string };
  reconciliation: Record<string, unknown>;
  detectedSheet: string;
  headerRowNumber: number;
  duplicateKeys: unknown[];
  detectedColumns: Record<string, number>;
  sourceRowsRead?: number;
  accountRows?: number;
  summaryRows?: number;
  emptyRows?: number;
  unknownRows?: number;
  validAccountRows?: number;
  invalidAccountRows?: number;
  reportedTotals?: Record<string, string | null> | null;
  systemTotals?: Record<string, string>;
  comparisons?: unknown[];
  reportedSummaries?: unknown[];
  calculatedTotals?: Record<string, string>;
  totalDifferences?: Record<string, string | null>;
  accountingChecks?: Record<string, boolean | null>;
  parserVersion?: string;
  voucherCount?: number;
  balancedVoucherCount?: number;
  unbalancedVoucherCount?: number;
  duplicateSequences?: unknown[];
  voucherBalances?: Record<string, unknown>;
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
    documentType?: TaxDocumentType,
  ) {
    await this.periods.get(companyId, periodId);
    const documents = await this.documents.find({
      where: { companyId, taxPeriodId: periodId, documentType },
      relations: { storedFile: true, uploadedByUser: true },
      order: { uploadedAt: "DESC" },
    });
    return documents.map((document) => this.present(document));
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

  async detail(companyId: string, periodId: string, id: string) {
    await this.periods.get(companyId, periodId);
    const document = await this.documents.findOne({
      where: { id, companyId, taxPeriodId: periodId },
      relations: { storedFile: true, uploadedByUser: true },
    });
    if (!document)
      throw new NotFoundException("Documento tributario no encontrado.");
    const replacement = await this.documents.findOneBy({
      replacesDocumentId: document.id,
      companyId,
      taxPeriodId: periodId,
    });
    return this.present(document, replacement?.id ?? null);
  }

  async create(
    companyId: string,
    periodId: string,
    userId: string,
    dto: CreateTaxDocumentDto,
  ): Promise<TaxDocumentEntity> {
    await this.periods.get(companyId, periodId);
    if (dto.documentType === TaxDocumentType.BALANCE && !dto.balanceRole)
      throw new BadRequestException("El rol del Balance es obligatorio.");
    if (dto.documentType !== TaxDocumentType.BALANCE && dto.balanceRole)
      throw new BadRequestException(
        "El rol solo corresponde a documentos Balance.",
      );
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
        balanceRole:
          dto.documentType === TaxDocumentType.BALANCE
            ? dto.balanceRole
            : IsNull(),
      },
      order: { versionNumber: "DESC" },
    });
    return this.documents.save(
      this.documents.create({
        companyId,
        taxPeriodId: periodId,
        storedFileId: file.id,
        documentType: dto.documentType,
        balanceRole: dto.balanceRole ?? null,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        uploadedByUserId: userId,
        uploadedAt: new Date(),
        cutoffDate: dto.cutoffDate ?? null,
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
    await this.documents.update(
      { id: document.id, companyId, taxPeriodId: periodId },
      { status: TaxDocumentStatus.PROCESSING, errorSummary: null },
    );
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
      const period = await this.periods.get(companyId, periodId);
      const parsed = this.parse(
        workbook,
        document.documentType,
        period,
        sheetName,
      );
      if (document.documentType !== TaxDocumentType.BALANCE)
        await this.reconcileMovements(document, parsed.rows, parsed.report);
      if (parsed.report.errors.length > 0) {
        document.status = TaxDocumentStatus.INVALID;
        // Preserve the import, source rows, entries and report as evidence,
        // without publishing period-account effects or superseding a valid version.
        await this.persist(document, parsed.rows, parsed.report, false);
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
      console.log(error);
      const errorSummary =
        error instanceof HttpException
          ? typeof error.getResponse() === "string"
            ? String(error.getResponse())
            : JSON.stringify(error.getResponse())
          : error instanceof Error
            ? error.message
            : "Error de procesamiento";
      await this.documents.update(
        { id: document.id, companyId, taxPeriodId: periodId },
        { status: TaxDocumentStatus.PROCESSING_ERROR, errorSummary },
      );
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

  private present(
    document: TaxDocumentEntity,
    replacedByDocumentId: string | null = null,
  ) {
    return {
      id: document.id,
      companyId: document.companyId,
      taxPeriodId: document.taxPeriodId,
      documentType: document.documentType,
      balanceRole: document.balanceRole,
      balanceRoleClassifiedAt: document.balanceRoleClassifiedAt,
      balanceRoleClassifiedByUserId: document.balanceRoleClassifiedByUserId,
      status: document.status,
      versionNumber: document.versionNumber,
      replacesDocumentId: document.replacesDocumentId,
      replacedByDocumentId,
      uploadedAt: document.uploadedAt,
      validatedAt: document.validatedAt,
      processedAt: document.processedAt,
      errorSummary: document.errorSummary,
      warningSummary: document.warningSummary,
      discardedAt: document.discardedAt,
      discardedByUserId: document.discardedByUserId,
      discardReason: document.discardReason,
      metadata: document.metadata,
      storedFile: {
        id: document.storedFile.id,
        originalName: document.storedFile.originalName,
        sizeBytes: document.storedFile.sizeBytes,
      },
      uploadedBy: document.uploadedByUser
        ? {
            id: document.uploadedByUser.id,
            name: `${document.uploadedByUser.firstName} ${document.uploadedByUser.lastName}`.trim(),
            email: document.uploadedByUser.email,
          }
        : null,
    };
  }

  private parse(
    workbook: XLSX.WorkBook,
    type: TaxDocumentType,
    period: Pick<TaxPeriodEntity, "commercialYear" | "startDate" | "endDate">,
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
        const resolved = resolveRequiredHeaders(matrix[row], contract);
        if (resolved.duplicates.length > 0)
          throw new BadRequestException({
            code: "DUPLICATE_CANONICAL_HEADER",
            message: "Dos o más columnas corresponden al mismo campo canónico.",
            duplicates: resolved.duplicates,
          });
        const map = resolved.map;
        if (resolved.missingFields.length === 0)
          candidates.push({ sheet, row, map, matrix });
      }
    }
    if (candidates.length !== 1) {
      if (candidates.length > 1)
        throw new BadRequestException(
          "MULTIPLE_SHEETS: selecciona una hoja candidata.",
        );
      const diagnostics = workbook.SheetNames.flatMap((sheet) => {
        const matrix = XLSX.utils.sheet_to_json<unknown[]>(
          workbook.Sheets[sheet],
          { header: 1, raw: true, defval: null },
        );
        return matrix
          .slice(0, 25)
          .map((headers) => resolveRequiredHeaders(headers, contract));
      });
      const closest = diagnostics.sort(
        (left, right) => left.missingFields.length - right.missingFields.length,
      )[0];
      throw new BadRequestException({
        code: "UNSUPPORTED_HEADER",
        message: "Faltan columnas requeridas.",
        missingFields: closest?.missingFields ?? Object.keys(contract.required),
      });
    }
    const candidate = candidates[0];
    if (type === TaxDocumentType.BALANCE) {
      const parsed = parseBalanceRows(
        candidate.matrix,
        candidate.row,
        candidate.map,
        candidate.sheet,
      );
      const accountRows = parsed.rows.filter(
        (row) => row.rowType === BalanceRowType.ACCOUNT,
      );
      const invalidAccountRows = new Set(
        parsed.errors
          .filter((issue) => issue.sourceRowNumber > 0)
          .map((issue) => issue.sourceRowNumber),
      ).size;
      const summaryRows = parsed.rows.filter((row) =>
        [
          BalanceRowType.SUBTOTAL,
          BalanceRowType.RESULT,
          BalanceRowType.TOTAL,
          BalanceRowType.REPORTED_SUMMARY,
        ].includes(row.rowType),
      ).length;
      return {
        rows: parsed.rows as unknown as Record<string, unknown>[],
        report: {
          rowsRead: parsed.rows.length,
          validRows: accountRows.length - invalidAccountRows,
          ignoredRows: parsed.rows.filter(
            (row) => row.rowType === BalanceRowType.EMPTY,
          ).length,
          sourceRowsRead: parsed.rows.length,
          accountRows: accountRows.length,
          summaryRows,
          emptyRows: parsed.rows.filter(
            (row) => row.rowType === BalanceRowType.EMPTY,
          ).length,
          unknownRows: parsed.rows.filter(
            (row) => row.rowType === BalanceRowType.UNKNOWN,
          ).length,
          validAccountRows: accountRows.length - invalidAccountRows,
          invalidAccountRows,
          errors: parsed.errors,
          warnings: parsed.warnings,
          totals: {
            debit: parsed.systemTotals.debits,
            credit: parsed.systemTotals.credits,
          },
          systemTotals: parsed.systemTotals,
          reportedTotals: parsed.reportedTotals,
          comparisons: parsed.comparisons,
          reportedSummaries: parsed.reportedSummaries,
          calculatedTotals: parsed.calculatedTotals,
          totalDifferences: parsed.totalDifferences,
          accountingChecks: parsed.accountingChecks,
          reconciliation: parsed.reconciliation,
          parserVersion: "balance-v2-source-preserving",
          detectedSheet: candidate.sheet,
          headerRowNumber: candidate.row + 1,
          duplicateKeys: [...parsed.errors, ...parsed.warnings]
            .filter((issue) => issue.code.startsWith("DUPLICATE_ACCOUNT"))
            .map((issue) => issue.rawValue),
          detectedColumns: candidate.map,
        },
      };
    }
    const movement =
      type === TaxDocumentType.GENERAL_LEDGER
        ? parseGeneralLedger({
            matrix: candidate.matrix,
            headerRow: candidate.row,
            columns: candidate.map,
            sheetName: candidate.sheet,
            period,
          })
        : parseJournal({
            matrix: candidate.matrix,
            headerRow: candidate.row,
            columns: candidate.map,
            sheetName: candidate.sheet,
            period,
          });
    const invalidRows = new Set(
      movement.errors
        .filter((issue) => issue.sourceRowNumber > 0)
        .map((issue) => issue.sourceRowNumber),
    );
    return {
      rows: movement.rows,
      report: {
        rowsRead: movement.rows.length,
        validRows: movement.rows.length - invalidRows.size,
        ignoredRows: movement.ignoredRows,
        errors: movement.errors,
        warnings: movement.warnings,
        totals: movement.totals,
        reconciliation: {},
        detectedSheet: candidate.sheet,
        headerRowNumber: candidate.row + 1,
        duplicateKeys: [],
        detectedColumns: candidate.map,
        parserVersion:
          type === TaxDocumentType.GENERAL_LEDGER
            ? "general-ledger-v1"
            : "journal-v1",
        ...movement.details,
      },
    };
  }

  private async reconcileMovements(
    document: TaxDocumentEntity,
    rows: Record<string, unknown>[],
    report: ImportReport,
  ): Promise<void> {
    const knownAccounts = (await this.dataSource.query(
      "SELECT id, internal_code FROM company_accounts WHERE company_id = ? AND deleted_at IS NULL",
      [document.companyId],
    )) as Array<{ id: string; internal_code: string }>;
    const knownCodes = new Set(
      knownAccounts.map((account) => account.internal_code),
    );
    for (const row of rows)
      if (!knownCodes.has(String(row.accountCode)))
        report.warnings.push({
          sourceRowNumber: Number(row.sourceRowNumber),
          field: "accountCode",
          code: "UNKNOWN_ACCOUNT",
          message:
            "La cuenta no existe en el catálogo generado por el Balance.",
          rawValue: row.accountCode,
        });
    const sourceTable =
      document.documentType === TaxDocumentType.GENERAL_LEDGER
        ? "balance_entries"
        : "general_ledger_entries";
    const importTable =
      document.documentType === TaxDocumentType.GENERAL_LEDGER
        ? "balance_imports"
        : "general_ledger_imports";
    const debitColumn =
      document.documentType === TaxDocumentType.GENERAL_LEDGER
        ? "reported_debits"
        : "debit";
    const creditColumn =
      document.documentType === TaxDocumentType.GENERAL_LEDGER
        ? "reported_credits"
        : "credit";
    const importForeignKey =
      document.documentType === TaxDocumentType.GENERAL_LEDGER
        ? "balance_import_id"
        : "general_ledger_import_id";
    const comparison = (await this.dataSource.query(
      `SELECT e.account_code, SUM(e.${debitColumn}) debit, SUM(e.${creditColumn}) credit
       FROM ${sourceTable} e JOIN ${importTable} i ON i.id = e.${importForeignKey}
       JOIN tax_documents d ON d.id = i.tax_document_id
       WHERE e.company_id = ? AND e.tax_period_id = ? AND d.status = 'processed'
         AND (d.document_type <> 'balance' OR d.balance_role = 'closing')
       GROUP BY e.account_code`,
      [document.companyId, document.taxPeriodId],
    )) as Array<{ account_code: string; debit: string; credit: string }>;
    if (comparison.length === 0) {
      report.reconciliation = {
        available: false,
        comparedWith:
          document.documentType === TaxDocumentType.GENERAL_LEDGER
            ? "balance"
            : "general_ledger",
        message:
          document.documentType === TaxDocumentType.GENERAL_LEDGER
            ? "No existe un Balance procesado para conciliar."
            : "No existe un Libro Mayor procesado para conciliar.",
      };
      return;
    }
    const imported = new Map<string, { debit: number; credit: number }>();
    for (const row of this.validMovementRows(rows, report)) {
      const code = String(row.accountCode);
      const total = imported.get(code) ?? { debit: 0, credit: 0 };
      total.debit += Number(row.debit);
      total.credit += Number(row.credit);
      imported.set(code, total);
    }
    const reference = new Map(
      comparison.map((row) => [
        row.account_code,
        { debit: Number(row.debit), credit: Number(row.credit) },
      ]),
    );
    const codes = new Set([...imported.keys(), ...reference.keys()]);
    const accounts = [...codes].map((accountCode) => {
      const current = imported.get(accountCode) ?? { debit: 0, credit: 0 };
      const expected = reference.get(accountCode) ?? { debit: 0, credit: 0 };
      return {
        accountCode,
        importedDebit: current.debit,
        importedCredit: current.credit,
        referenceDebit: expected.debit,
        referenceCredit: expected.credit,
        debitDifference: current.debit - expected.debit,
        creditDifference: current.credit - expected.credit,
        missingInImportedDocument: !imported.has(accountCode),
        missingInReferenceDocument: !reference.has(accountCode),
      };
    });
    for (const account of accounts)
      if (
        Math.abs(account.debitDifference) > 0.0001 ||
        Math.abs(account.creditDifference) > 0.0001
      )
        report.warnings.push({
          sourceRowNumber: 0,
          field: "reconciliation",
          code: "ACCOUNT_RECONCILIATION_DIFFERENCE",
          message: `La cuenta ${account.accountCode} presenta diferencias en la conciliación.`,
          rawValue: account,
        });
    report.reconciliation = {
      available: true,
      comparedWith:
        document.documentType === TaxDocumentType.GENERAL_LEDGER
          ? "balance"
          : "general_ledger",
      accounts,
      differenceCount: accounts.filter(
        (account) =>
          Math.abs(account.debitDifference) > 0.0001 ||
          Math.abs(account.creditDifference) > 0.0001,
      ).length,
    };
  }

  private async persist(
    document: TaxDocumentEntity,
    rows: Record<string, unknown>[],
    report: ImportReport,
    operational = true,
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
      if (document.documentType === TaxDocumentType.BALANCE) {
        const totals = report.systemTotals ?? {};
        await manager.query(
          "UPDATE balance_imports SET sheet_name = ?, header_row_number = ?, total_debit_balance = ?, total_credit_balance = ?, total_assets = ?, total_liabilities = ?, total_losses = ?, total_gains = ?, is_debit_credit_balanced = ?, is_equity_balanced = ?, validation_report = ? WHERE id = ?",
          [
            report.detectedSheet,
            report.headerRowNumber,
            totals.debitBalance ?? 0,
            totals.creditBalance ?? 0,
            totals.assets ?? 0,
            totals.liabilities ?? 0,
            totals.losses ?? 0,
            totals.gains ?? 0,
            Boolean(
              (report.reconciliation.movements as { isBalanced?: boolean })
                ?.isBalanced,
            ),
            Boolean(
              (report.reconciliation.equity as { isBalanced?: boolean })
                ?.isBalanced,
            ),
            JSON.stringify(report),
            importId,
          ],
        );
        await this.persistBalance(
          manager,
          document,
          importId,
          rows,
          report,
          operational,
        );
      } else if (document.documentType === TaxDocumentType.GENERAL_LEDGER) {
        await this.persistGeneralLedger(
          manager,
          document,
          importId,
          rows,
          report,
        );
      } else {
        await manager.query(
          "UPDATE journal_imports SET vouchers_read = ?, balanced_vouchers = ?, unbalanced_vouchers = ? WHERE id = ?",
          [
            report.voucherCount ?? 0,
            report.balancedVoucherCount ?? 0,
            report.unbalancedVoucherCount ?? 0,
            importId,
          ],
        );
        await this.persistJournal(manager, document, importId, rows, report);
      }
      if (operational && report.validRows === 0)
        throw new Error(
          "No existen filas válidas para publicar la importación.",
        );
      document.status = operational
        ? TaxDocumentStatus.PROCESSED
        : TaxDocumentStatus.INVALID;
      document.validatedAt = new Date();
      document.processedAt = new Date();
      document.metadata = report;
      document.errorSummary = report.errors.length
        ? `${report.errors.length} errores de validación`
        : null;
      await manager.save(document);
      if (!operational) return;
      const previous = await manager.findOne(TaxDocumentEntity, {
        where: {
          companyId: document.companyId,
          taxPeriodId: document.taxPeriodId,
          documentType: document.documentType,
          balanceRole: document.balanceRole ?? IsNull(),
          status: TaxDocumentStatus.PROCESSED,
          versionNumber: LessThan(document.versionNumber),
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

  private validMovementRows(
    rows: Record<string, unknown>[],
    report: ImportReport,
  ): Record<string, unknown>[] {
    const invalid = new Set(
      report.errors
        .filter((error) => error.sourceRowNumber > 0)
        .map((error) => error.sourceRowNumber),
    );
    return rows.filter((row) => !invalid.has(Number(row.sourceRowNumber)));
  }

  private async accountIds(
    manager: EntityManager,
    document: TaxDocumentEntity,
  ): Promise<Map<string, string>> {
    const accounts = (await manager.query(
      "SELECT id, internal_code FROM company_accounts WHERE company_id = ? AND deleted_at IS NULL",
      [document.companyId],
    )) as Array<{ id: string; internal_code: string }>;
    return new Map(
      accounts.map((account) => [account.internal_code, account.id]),
    );
  }

  private async persistGeneralLedger(
    manager: EntityManager,
    document: TaxDocumentEntity,
    importId: string,
    rows: Record<string, unknown>[],
    report: ImportReport,
  ): Promise<void> {
    const accountIds = await this.accountIds(manager, document);
    for (const row of this.validMovementRows(rows, report))
      await manager.query(
        "INSERT INTO general_ledger_entries (id, general_ledger_import_id, company_id, tax_period_id, company_account_id, account_code, account_name, transaction_date, document_type, document_number, description, debit, credit, source_row_number, raw_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), NOW(6))",
        [
          randomUUID(),
          importId,
          document.companyId,
          document.taxPeriodId,
          accountIds.get(String(row.accountCode)) ?? null,
          row.accountCode,
          row.accountName,
          row.date,
          row.documentType,
          row.documentNumber,
          row.description,
          row.debit,
          row.credit,
          row.sourceRowNumber,
          JSON.stringify(row.rawData),
        ],
      );
  }

  private async persistJournal(
    manager: EntityManager,
    document: TaxDocumentEntity,
    importId: string,
    rows: Record<string, unknown>[],
    report: ImportReport,
  ): Promise<void> {
    const accountIds = await this.accountIds(manager, document);
    for (const row of this.validMovementRows(rows, report))
      await manager.query(
        "INSERT INTO journal_entries (id, journal_import_id, company_id, tax_period_id, company_account_id, transaction_date, voucher_number, sequence_number, account_code, account_name, debit, credit, description, source_row_number, raw_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), NOW(6))",
        [
          randomUUID(),
          importId,
          document.companyId,
          document.taxPeriodId,
          accountIds.get(String(row.accountCode)) ?? null,
          row.date,
          row.voucherNumber,
          row.sequence,
          row.accountCode,
          row.accountName || null,
          row.debit,
          row.credit,
          row.description,
          row.sourceRowNumber,
          JSON.stringify(row.rawData),
        ],
      );
  }

  private async persistBalance(
    manager: EntityManager,
    document: TaxDocumentEntity,
    importId: string,
    rows: Record<string, unknown>[],
    report: ImportReport,
    operational: boolean,
  ): Promise<void> {
    const balanceRows = rows as unknown as BalanceParsedRow[];
    for (const row of balanceRows) {
      const sourceRowId = randomUUID();
      await manager.query(
        "INSERT INTO balance_source_rows (id, balance_import_id, company_id, tax_period_id, source_row_number, sheet_name, row_type, account_code_raw, account_name_raw, debits_raw, credits_raw, debit_balance_raw, credit_balance_raw, assets_raw, liabilities_raw, losses_raw, gains_raw, raw_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), NOW(6))",
        [
          sourceRowId,
          importId,
          document.companyId,
          document.taxPeriodId,
          row.sourceRowNumber,
          row.sheetName,
          row.rowType,
          JSON.stringify(row.rawData[report.detectedColumns.accountCode]),
          JSON.stringify(row.rawData[report.detectedColumns.accountName]),
          ...BALANCE_MONETARY_FIELDS.map((field) =>
            JSON.stringify(row.rawData[report.detectedColumns[field]]),
          ),
          JSON.stringify(row.rawData),
        ],
      );
      if (
        [
          BalanceRowType.SUBTOTAL,
          BalanceRowType.RESULT,
          BalanceRowType.TOTAL,
          BalanceRowType.REPORTED_SUMMARY,
        ].includes(row.rowType)
      ) {
        await manager.query(
          "INSERT INTO balance_reported_summaries (id, balance_import_id, source_row_id, company_id, tax_period_id, tax_document_id, balance_role, source_row_number, summary_type, label, normalized_label, reported_debits, reported_credits, reported_debit_balance, reported_credit_balance, reported_assets, reported_liabilities, reported_losses, reported_gains, raw_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), NOW(6))",
          [
            randomUUID(),
            importId,
            sourceRowId,
            document.companyId,
            document.taxPeriodId,
            document.id,
            document.balanceRole,
            row.sourceRowNumber,
            reportedSummaryType(row),
            row.accountName ?? "",
            normalizeSummaryLabel(row.accountName),
            ...BALANCE_MONETARY_FIELDS.map(
              (field) => row.money[field].reportedDecimal,
            ),
            JSON.stringify(row.rawData),
          ],
        );
      }
      if (
        row.rowType !== BalanceRowType.ACCOUNT ||
        !row.accountCode ||
        !row.accountName
      )
        continue;
      const entryId = randomUUID();
      const existing = operational
        ? (
            await manager.query(
              "SELECT id, name FROM company_accounts WHERE company_id = ? AND internal_code = ? AND deleted_at IS NULL LIMIT 1",
              [document.companyId, row.accountCode],
            )
          )[0]
        : null;
      let accountId = existing?.id ?? null;
      if (operational && !accountId) {
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
      }
      await manager.query(
        "INSERT INTO balance_entries (id, balance_import_id, company_id, tax_period_id, company_account_id, source_row_id, account_code, account_name, reported_debits, reported_credits, reported_debit_balance, reported_credit_balance, reported_assets, reported_liabilities, reported_losses, reported_gains, effective_debits, effective_credits, effective_debit_balance, effective_credit_balance, effective_assets, effective_liabilities, effective_losses, effective_gains, calculated_debit_balance, calculated_credit_balance, debits_was_blank, credits_was_blank, debit_balance_was_blank, credit_balance_was_blank, assets_was_blank, liabilities_was_blank, losses_was_blank, gains_was_blank, source_row_number, raw_data, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), NOW(6))",
        [
          entryId,
          importId,
          document.companyId,
          document.taxPeriodId,
          accountId,
          sourceRowId,
          row.accountCode,
          row.accountName,
          ...BALANCE_MONETARY_FIELDS.map(
            (field) => row.money[field].reportedDecimal,
          ),
          ...BALANCE_MONETARY_FIELDS.map(
            (field) => row.money[field].effectiveDecimal,
          ),
          row.calculatedDebitBalance,
          row.calculatedCreditBalance,
          ...BALANCE_MONETARY_FIELDS.map((field) => row.money[field].wasBlank),
          row.sourceRowNumber,
          JSON.stringify(row.rawData),
        ],
      );
      if (!operational) continue;
      if (existing) {
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
      // Opening balances enrich the persistent company account catalogue, but
      // only the closing balance is published as the period's explorer rows.
      if (document.balanceRole === BalanceRole.OPENING) continue;
      await manager.query(
        "INSERT INTO tax_period_company_accounts (id, company_id, tax_period_id, company_account_id, source_document_id, balance_entry_id, account_code_snapshot, account_name_snapshot, debit_amount, credit_amount, debit_balance, credit_balance, asset_amount, liability_amount, loss_amount, gain_amount, first_seen_at, last_seen_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(6), NOW(6), NOW(6), NOW(6)) ON DUPLICATE KEY UPDATE source_document_id=VALUES(source_document_id), balance_entry_id=VALUES(balance_entry_id), account_code_snapshot=VALUES(account_code_snapshot), account_name_snapshot=VALUES(account_name_snapshot), debit_amount=VALUES(debit_amount), credit_amount=VALUES(credit_amount), debit_balance=VALUES(debit_balance), credit_balance=VALUES(credit_balance), asset_amount=VALUES(asset_amount), liability_amount=VALUES(liability_amount), loss_amount=VALUES(loss_amount), gain_amount=VALUES(gain_amount), discarded_at=NULL, discarded_by_document_id=NULL, last_seen_at=NOW(6), updated_at=NOW(6)",
        [
          randomUUID(),
          document.companyId,
          document.taxPeriodId,
          accountId,
          document.id,
          entryId,
          row.accountCode,
          row.accountName,
          ...BALANCE_MONETARY_FIELDS.map(
            (field) => row.money[field].reportedDecimal,
          ),
        ],
      );
    }
    if (operational && document.balanceRole === BalanceRole.CLOSING)
      await manager.query(
        `UPDATE tax_period_company_accounts
         SET discarded_at=NOW(6), discarded_by_document_id=?, updated_at=NOW(6)
         WHERE company_id=? AND tax_period_id=? AND source_document_id<>? AND discarded_at IS NULL`,
        [document.id, document.companyId, document.taxPeriodId, document.id],
      );
  }

  async classifyHistoricalBalance(
    companyId: string,
    periodId: string,
    id: string,
    userId: string,
    balanceRole: BalanceRole,
  ) {
    await this.periods.get(companyId, periodId);
    return this.dataSource.transaction(async (manager) => {
      const document = await manager.findOne(TaxDocumentEntity, {
        where: { id, companyId, taxPeriodId: periodId },
        lock: { mode: "pessimistic_write" },
      });
      if (!document || document.documentType !== TaxDocumentType.BALANCE)
        throw new NotFoundException("Balance histórico no encontrado.");
      if (document.balanceRole !== null)
        throw new BadRequestException(
          "El Balance ya se encuentra clasificado.",
        );
      const conflict = await manager.findOne(TaxDocumentEntity, {
        where: {
          companyId,
          taxPeriodId: periodId,
          documentType: TaxDocumentType.BALANCE,
          balanceRole,
          status: TaxDocumentStatus.PROCESSED,
        },
      });
      if (conflict)
        throw new BadRequestException(
          "Ya existe una fuente procesada para ese rol en el período.",
        );
      const versionConflict = await manager.findOneBy(TaxDocumentEntity, {
        companyId,
        taxPeriodId: periodId,
        documentType: TaxDocumentType.BALANCE,
        balanceRole,
        versionNumber: document.versionNumber,
      });
      if (versionConflict)
        throw new BadRequestException(
          "La clasificación entra en conflicto con una versión existente del rol.",
        );
      document.balanceRole = balanceRole;
      document.balanceRoleClassifiedAt = new Date();
      document.balanceRoleClassifiedByUserId = userId;
      const saved = await manager.save(document);
      if (balanceRole === BalanceRole.OPENING)
        await manager.query(
          `UPDATE tax_period_company_accounts SET discarded_at=NOW(6), discarded_by_document_id=?, updated_at=NOW(6)
           WHERE company_id=? AND tax_period_id=? AND source_document_id=? AND discarded_at IS NULL`,
          [document.id, companyId, periodId, document.id],
        );
      return saved;
    });
  }

  async discard(
    companyId: string,
    periodId: string,
    id: string,
    userId: string,
    reason: string,
  ) {
    await this.periods.get(companyId, periodId);
    return this.dataSource.transaction(async (manager) => {
      const document = await manager.findOne(TaxDocumentEntity, {
        where: { id, companyId, taxPeriodId: periodId },
        lock: { mode: "pessimistic_write" },
      });
      if (!document)
        throw new NotFoundException("Documento tributario no encontrado.");
      if (document.documentType !== TaxDocumentType.BALANCE)
        throw new BadRequestException(
          "Solo se pueden descartar versiones de Balance.",
        );
      if (document.status === TaxDocumentStatus.DISCARDED)
        throw new BadRequestException("La versión ya fue descartada.");

      const previousStatus = document.status;
      const affectedAccounts = (await manager.query(
        `SELECT p.company_account_id
         FROM tax_period_company_accounts p
         WHERE p.company_id = ? AND p.tax_period_id = ?
           AND p.source_document_id = ? AND p.discarded_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM balance_entries e
             JOIN balance_imports i ON i.id = e.balance_import_id
             JOIN tax_documents d ON d.id = i.tax_document_id
             JOIN company_accounts a ON a.company_id = e.company_id
               AND a.internal_code = e.account_code AND a.id = p.company_account_id
             WHERE e.company_id = p.company_id AND e.tax_period_id = p.tax_period_id
               AND d.id <> ? AND d.status IN ('processed', 'superseded')
           )`,
        [companyId, periodId, id, id],
      )) as Array<{ company_account_id: string }>;
      const accountIds = affectedAccounts.map((row) => row.company_account_id);
      let supersededSuggestions = 0;
      if (accountIds.length) {
        const result = await manager
          .createQueryBuilder()
          .update(CompanyAccountSuggestionEntity)
          .set({ status: CompanyAccountSuggestionStatus.SUPERSEDED })
          .where("company_account_id IN (:...accountIds)", { accountIds })
          .andWhere("status IN (:...statuses)", {
            statuses: [
              CompanyAccountSuggestionStatus.ACTIVE,
              CompanyAccountSuggestionStatus.REVIEW,
            ],
          })
          .execute();
        supersededSuggestions = result.affected ?? 0;
      }
      const presenceResult = (await manager.query(
        `UPDATE tax_period_company_accounts
         SET discarded_at = NOW(6), discarded_by_document_id = ?, updated_at = NOW(6)
         WHERE company_id = ? AND tax_period_id = ? AND source_document_id = ?
           AND discarded_at IS NULL
           AND company_account_id IN (${accountIds.length ? accountIds.map(() => "?").join(",") : "NULL"})`,
        [id, companyId, periodId, id, ...accountIds],
      )) as { affectedRows?: number };
      document.statusBeforeDiscard = previousStatus;
      document.status = TaxDocumentStatus.DISCARDED;
      document.discardedAt = new Date();
      document.discardedByUserId = userId;
      document.discardReason = reason.trim();
      await manager.save(document);
      return {
        documentId: id,
        discarded: true,
        previousStatus,
        currentStatus: document.status,
        removedPeriodAccountPresences: presenceResult.affectedRows ?? 0,
        supersededSuggestions,
        preservedCompanyAccounts: accountIds.length,
        preservedConfirmedMappings: accountIds.length,
      };
    });
  }
}

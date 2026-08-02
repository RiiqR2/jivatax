import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  BalanceExplorerQueryDto,
  GeneralLedgerQueryDto,
} from "../dto/accounting-explorer.dto";
import { TaxPeriodsService } from "./tax-periods.service";

type Row = Record<string, string | number | null>;
export const RECONCILIATION_TOLERANCE = "0.0100";
export function accumulatedBalance(
  rows: Array<{ debit: number; credit: number }>,
  opening = 0,
) {
  let balance = opening;
  return rows.map((row) => (balance += row.debit - row.credit));
}

@Injectable()
export class AccountingExplorerService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly periods: TaxPeriodsService,
  ) {}

  async balance(
    companyId: string,
    periodId: string,
    query: BalanceExplorerQueryDto,
  ) {
    const period = (await this.periods.get(companyId, periodId)) as unknown as {
      commercialYear: number;
      taxYear: number;
    };
    const sourceRows = (await this.db.query(
      `SELECT d.id, d.document_type documentType, d.version_number versionNumber, d.processed_at processedAt,
        c.legal_name companyName
       FROM tax_documents d JOIN companies c ON c.id=d.company_id
       WHERE d.company_id=? AND d.tax_period_id=? AND d.status='processed'
         AND d.discarded_at IS NULL AND d.document_type IN ('balance','general_ledger')
       ORDER BY d.document_type, d.version_number DESC`,
      [companyId, periodId],
    )) as Row[];
    const balanceDocument = sourceRows.find(
      (row) => row.documentType === "balance",
    );
    const ledgerDocument = sourceRows.find(
      (row) => row.documentType === "general_ledger",
    );
    const source = (row: Row | undefined) =>
      row
        ? {
            id: String(row.id),
            versionNumber: Number(row.versionNumber),
            processedAt: row.processedAt,
          }
        : null;
    const sources = {
      companyName: String(sourceRows[0]?.companyName ?? ""),
      commercialYear: period.commercialYear,
      taxYear: period.taxYear,
      balanceDocument: source(balanceDocument),
      generalLedgerDocument: source(ledgerDocument),
    };
    if (!balanceDocument) {
      return {
        summary: this.emptySummary(false),
        sources,
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
        balanceAvailable: false,
      };
    }
    const where = [
      "pa.company_id = ?",
      "pa.tax_period_id = ?",
      "pa.discarded_at IS NULL",
      "pa.source_document_id = ?",
    ];
    const params: unknown[] = [companyId, periodId, balanceDocument.id];
    if (query.search) {
      where.push(
        "(pa.account_code_snapshot LIKE ? OR pa.account_name_snapshot LIKE ?)",
      );
      params.push(`%${query.search}%`, `%${query.search}%`);
    }
    if (query.code) {
      where.push("pa.account_code_snapshot LIKE ?");
      params.push(`%${query.code}%`);
    }
    if (query.name) {
      where.push("pa.account_name_snapshot LIKE ?");
      params.push(`%${query.name}%`);
    }
    if (query.mapping === "mapped") where.push("m.status = 'confirmed'");
    if (query.mapping === "pending")
      where.push("(m.status IS NULL OR m.status <> 'confirmed')");
    const sectionColumns: Record<string, string> = {
      asset: "asset_amount",
      liability: "liability_amount",
      loss: "loss_amount",
      gain: "gain_amount",
    };
    if (query.section) where.push(`pa.${sectionColumns[query.section]} <> 0`);
    const ledgerAvailable = Boolean(ledgerDocument);
    const ledgerJoin = ledgerDocument
      ? `LEFT JOIN (SELECT e.company_account_id, CAST(SUM(e.debit) AS DECIMAL(24,4)) ledgerDebit,
          CAST(SUM(e.credit) AS DECIMAL(24,4)) ledgerCredit, COUNT(*) ledgerMovementCount,
          MAX(e.transaction_date) lastLedgerMovementDate
        FROM general_ledger_entries e JOIN general_ledger_imports gli ON gli.id=e.general_ledger_import_id
        WHERE gli.tax_document_id=? AND e.company_id=? AND e.tax_period_id=? GROUP BY e.company_account_id) l
        ON l.company_account_id=pa.company_account_id`
      : "LEFT JOIN (SELECT NULL company_account_id, NULL ledgerDebit, NULL ledgerCredit, 0 ledgerMovementCount, NULL lastLedgerMovementDate) l ON 1=0";
    const ledgerParams: unknown[] = ledgerDocument
      ? [ledgerDocument.id, companyId, periodId]
      : [];
    const statusSql = ledgerAvailable
      ? `CASE WHEN COALESCE(l.ledgerMovementCount,0)=0 THEN 'no_ledger'
          WHEN ABS(pa.debit_amount-COALESCE(l.ledgerDebit,0))<=${RECONCILIATION_TOLERANCE}
           AND ABS(pa.credit_amount-COALESCE(l.ledgerCredit,0))<=${RECONCILIATION_TOLERANCE}
          THEN 'reconciled' ELSE 'difference' END`
      : "'unavailable'";
    const cte = `WITH explorer AS (SELECT pa.company_account_id accountId, pa.account_code_snapshot code,
      pa.account_name_snapshot name, CASE WHEN m.status='confirmed' THEN s.code ELSE NULL END siiCode,
      CASE WHEN m.status='confirmed' THEN s.name ELSE NULL END siiName, COALESCE(m.status,'pending') mappingStatus,
      CAST(pa.debit_amount AS DECIMAL(24,4)) balanceDebit, CAST(pa.credit_amount AS DECIMAL(24,4)) balanceCredit,
      pa.debit_balance debitBalance, pa.credit_balance creditBalance, pa.asset_amount assetAmount,
      pa.liability_amount liabilityAmount, pa.loss_amount lossAmount, pa.gain_amount gainAmount,
      ${ledgerAvailable ? "COALESCE(l.ledgerDebit,0)" : "NULL"} ledgerDebit,
      ${ledgerAvailable ? "COALESCE(l.ledgerCredit,0)" : "NULL"} ledgerCredit,
      ${ledgerAvailable ? "pa.debit_amount-COALESCE(l.ledgerDebit,0)" : "NULL"} debitDifference,
      ${ledgerAvailable ? "pa.credit_amount-COALESCE(l.ledgerCredit,0)" : "NULL"} creditDifference,
      ${statusSql} reconciliationStatus, COALESCE(l.ledgerMovementCount,0) ledgerMovementCount,
      l.lastLedgerMovementDate, COALESCE(l.ledgerMovementCount,0)>0 hasLedgerMovements, TRUE canOpenLedger
      FROM tax_period_company_accounts pa
      LEFT JOIN company_account_mappings m ON m.company_account_id=pa.company_account_id
      LEFT JOIN sii_accounts s ON s.id=m.sii_account_id ${ledgerJoin}
      WHERE ${where.join(" AND ")})`;
    const filtered =
      query.reconciliation && query.reconciliation !== "all"
        ? " WHERE reconciliationStatus=?"
        : "";
    const filterParams =
      query.reconciliation && query.reconciliation !== "all"
        ? [query.reconciliation]
        : [];
    const sortColumns: Record<string, string> = {
      code: "code",
      name: "name",
      debit: "balanceDebit",
      credit: "balanceCredit",
      difference:
        "(ABS(COALESCE(debitDifference,0))+ABS(COALESCE(creditDifference,0)))",
      movements: "ledgerMovementCount",
      lastMovement: "lastLedgerMovementDate",
    };
    const offset = (query.page - 1) * query.pageSize;
    const sql = `${cte} SELECT explorer.*, COUNT(*) OVER() total FROM explorer${filtered}
      ORDER BY ${sortColumns[query.sort]} ${query.direction.toUpperCase()}, accountId ASC LIMIT ? OFFSET ?`;
    const rows = (await this.db.query(sql, [
      ...ledgerParams,
      ...params,
      ...filterParams,
      query.pageSize,
      offset,
    ])) as Row[];
    const summaries = (await this.db.query(
      `${cte} SELECT COUNT(*) totalAccounts,
       SUM(mappingStatus='confirmed') mappedAccounts, SUM(mappingStatus<>'confirmed') pendingMappingAccounts,
       SUM(reconciliationStatus='reconciled') reconciledAccounts,
       SUM(reconciliationStatus='difference') accountsWithDifferences,
       SUM(reconciliationStatus='no_ledger') accountsWithoutLedgerMovements,
       ${ledgerAvailable ? "FALSE" : "TRUE"} reconciliationUnavailable,
       CAST(COALESCE(SUM(balanceDebit),0) AS DECIMAL(24,4)) totalBalanceDebit,
       CAST(${ledgerAvailable ? "COALESCE(SUM(ledgerDebit),0)" : "NULL"} AS DECIMAL(24,4)) totalLedgerDebit,
       CAST(COALESCE(SUM(balanceCredit),0) AS DECIMAL(24,4)) totalBalanceCredit,
       CAST(${ledgerAvailable ? "COALESCE(SUM(ledgerCredit),0)" : "NULL"} AS DECIMAL(24,4)) totalLedgerCredit,
       CAST(${ledgerAvailable ? "COALESCE(SUM(debitDifference),0)" : "NULL"} AS DECIMAL(24,4)) totalDebitDifference,
       CAST(${ledgerAvailable ? "COALESCE(SUM(creditDifference),0)" : "NULL"} AS DECIMAL(24,4)) totalCreditDifference FROM explorer`,
      [...ledgerParams, ...params],
    )) as Row[];
    return {
      summary: summaries[0] ?? this.emptySummary(ledgerAvailable),
      sources,
      items: rows.map(({ total: _, ...row }) => row),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(rows[0]?.total ?? 0),
      balanceAvailable: true,
    };
  }

  private emptySummary(ledgerAvailable: boolean) {
    return {
      totalAccounts: 0,
      mappedAccounts: 0,
      pendingMappingAccounts: 0,
      reconciledAccounts: 0,
      accountsWithDifferences: 0,
      accountsWithoutLedgerMovements: 0,
      reconciliationUnavailable: !ledgerAvailable,
      totalBalanceDebit: "0.0000",
      totalBalanceCredit: "0.0000",
      totalLedgerDebit: ledgerAvailable ? "0.0000" : null,
      totalLedgerCredit: ledgerAvailable ? "0.0000" : null,
      totalDebitDifference: ledgerAvailable ? "0.0000" : null,
      totalCreditDifference: ledgerAvailable ? "0.0000" : null,
    };
  }

  async generalLedger(
    companyId: string,
    periodId: string,
    accountId: string,
    query: GeneralLedgerQueryDto,
  ) {
    await this.periods.get(companyId, periodId);
    const accounts = (await this.db.query(
      "SELECT id, internal_code code, name FROM company_accounts WHERE id = ? AND company_id = ? LIMIT 1",
      [accountId, companyId],
    )) as Row[];
    if (!accounts[0])
      throw new NotFoundException("Cuenta contable no encontrada.");
    const where = [
      "e.company_id = ?",
      "e.tax_period_id = ?",
      "e.company_account_id = ?",
      "d.discarded_at IS NULL",
      "d.status = 'processed'",
      `d.id = (SELECT current_document.id FROM tax_documents current_document
        WHERE current_document.company_id=e.company_id AND current_document.tax_period_id=e.tax_period_id
          AND current_document.document_type='general_ledger' AND current_document.status='processed'
          AND current_document.discarded_at IS NULL ORDER BY current_document.version_number DESC LIMIT 1)`,
    ];
    const params: unknown[] = [companyId, periodId, accountId];
    if (query.from) {
      where.push("e.transaction_date >= ?");
      params.push(query.from);
    }
    if (query.to) {
      where.push("e.transaction_date <= ?");
      params.push(query.to);
    }
    if (query.documentType) {
      where.push("e.document_type LIKE ?");
      params.push(`%${query.documentType}%`);
    }
    if (query.documentNumber) {
      where.push("e.document_number LIKE ?");
      params.push(`%${query.documentNumber}%`);
    }
    if (query.search) {
      where.push(
        "(e.description LIKE ? OR e.document_number LIKE ? OR e.document_type LIKE ?)",
      );
      params.push(...Array(3).fill(`%${query.search}%`));
    }
    const sort: Record<string, string> = {
      date: "transactionDate",
      documentType: "documentType",
      documentNumber: "documentNumber",
      description: "description",
      debit: "debit",
      credit: "credit",
      runningBalance: "runningBalance",
    };
    const offset = (query.page - 1) * query.pageSize;
    const sql = `SELECT filtered.*, SUM(filtered.debit - filtered.credit) OVER (ORDER BY filtered.transactionDate, filtered.id ROWS UNBOUNDED PRECEDING) runningBalance, COUNT(*) OVER() total
      FROM (SELECT e.id, e.transaction_date transactionDate, e.document_type documentType, e.document_number documentNumber, e.description,
        CAST(e.debit AS DECIMAL(24,4)) debit, CAST(e.credit AS DECIMAL(24,4)) credit
        FROM general_ledger_entries e JOIN general_ledger_imports i ON i.id=e.general_ledger_import_id JOIN tax_documents d ON d.id=i.tax_document_id
        WHERE ${where.join(" AND ")}) filtered
      ORDER BY ${sort[query.sort]} ${query.direction.toUpperCase()}, id ASC LIMIT ? OFFSET ?`;
    const rows = (await this.db.query(sql, [
      ...params,
      query.pageSize,
      offset,
    ])) as Row[];
    return {
      account: accounts[0],
      items: rows.map(({ total: _, ...row }) => row),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(rows[0]?.total ?? 0),
    };
  }
}

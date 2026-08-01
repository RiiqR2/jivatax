import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  BalanceExplorerQueryDto,
  GeneralLedgerQueryDto,
} from "../dto/accounting-explorer.dto";
import { TaxPeriodsService } from "./tax-periods.service";

type Row = Record<string, string | number | null>;
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
    await this.periods.get(companyId, periodId);
    const where = [
      "pa.company_id = ?",
      "pa.tax_period_id = ?",
      "pa.discarded_at IS NULL",
    ];
    const params: unknown[] = [companyId, periodId];
    if (query.code) {
      where.push("pa.account_code_snapshot LIKE ?");
      params.push(`%${query.code}%`);
    }
    if (query.name) {
      where.push("pa.account_name_snapshot LIKE ?");
      params.push(`%${query.name}%`);
    }
    if (query.mapping === "mapped") where.push("m.sii_account_id IS NOT NULL");
    if (query.mapping === "pending") where.push("m.sii_account_id IS NULL");
    const sectionColumns: Record<string, string> = {
      asset: "asset_amount",
      liability: "liability_amount",
      loss: "loss_amount",
      gain: "gain_amount",
    };
    if (query.section) where.push(`pa.${sectionColumns[query.section]} <> 0`);
    const sortColumns: Record<string, string> = {
      code: "pa.account_code_snapshot",
      name: "pa.account_name_snapshot",
      debit: "pa.debit_amount",
      credit: "pa.credit_amount",
    };
    const offset = (query.page - 1) * query.pageSize;
    const sql = `SELECT pa.company_account_id accountId, pa.account_code_snapshot code, pa.account_name_snapshot name,
      s.code siiCode, s.name siiName, pa.debit_amount debit, pa.credit_amount credit,
      pa.debit_balance debitBalance, pa.credit_balance creditBalance, COUNT(*) OVER() total
      FROM tax_period_company_accounts pa
      LEFT JOIN company_account_mappings m ON m.company_account_id = pa.company_account_id
      LEFT JOIN sii_accounts s ON s.id = m.sii_account_id
      WHERE ${where.join(" AND ")} ORDER BY ${sortColumns[query.sort]} ${query.direction.toUpperCase()}, pa.company_account_id ASC LIMIT ? OFFSET ?`;
    const rows = (await this.db.query(sql, [
      ...params,
      query.pageSize,
      offset,
    ])) as Row[];
    return {
      items: rows.map(({ total: _, ...row }) => row),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(rows[0]?.total ?? 0),
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

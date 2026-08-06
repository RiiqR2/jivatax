import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import {
  BalanceExplorerQueryDto,
  GeneralLedgerQueryDto,
  OpeningControlQueryDto,
} from "../dto/accounting-explorer.dto";
import { TaxPeriodsService } from "./tax-periods.service";

type Row = Record<string, string | number | boolean | null>;
type ExplorerSource = {
  id: string;
  importId: string | null;
  documentType: "balance" | "general_ledger";
  versionNumber: number;
  processedAt: string | null;
  balanceRole: "opening" | "closing" | null;
};
export const RECONCILIATION_TOLERANCE = "0.0100";

const BALANCE_ITEM_AMOUNT_FIELDS = [
  "balanceDebits",
  "balanceCredits",
  "balanceDebitBalance",
  "balanceCreditBalance",
  "balanceAssets",
  "balanceLiabilities",
  "balanceLosses",
  "balanceGains",
  "ledgerDebit",
  "ledgerCredit",
  "debitDifference",
  "creditDifference",
] as const;

function coalescedBalanceAmount(
  periodColumn: string,
  entryColumn: string,
  alias: string,
) {
  return `CAST(COALESCE(pa.${periodColumn}, be.${entryColumn}, 0) AS DECIMAL(24,4)) ${alias}`;
}

function normalizeExplorerAmount(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

function normalizeBalanceItem(row: Row): Row {
  const normalized: Row = { ...row };
  for (const field of BALANCE_ITEM_AMOUNT_FIELDS) {
    const value =
      row[field] ??
      row[field.toLowerCase()] ??
      row[field.replace(/([A-Z])/g, "_$1").toLowerCase()];
    if (value !== undefined) normalized[field] = normalizeExplorerAmount(value);
  }
  return normalized;
}

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

  private async resolveSources(
    companyId: string,
    periodId: string,
    balanceDocumentId?: string,
  ) {
    const rows = (await this.db.query(
      `SELECT d.id, d.document_type documentType, d.balance_role balanceRole, d.version_number versionNumber,
        d.processed_at processedAt, c.legal_name companyName, gli.id importId
       FROM tax_documents d
       JOIN companies c ON c.id=d.company_id
       LEFT JOIN general_ledger_imports gli
         ON gli.tax_document_id=d.id AND gli.company_id=d.company_id AND gli.tax_period_id=d.tax_period_id
       WHERE d.company_id=? AND d.tax_period_id=? AND d.status IN ('processed','superseded')
         AND d.discarded_at IS NULL AND d.document_type IN ('balance','general_ledger')
         AND ((d.document_type='balance' AND d.balance_role='closing' AND ? IS NOT NULL AND d.id=?) OR
         ((? IS NULL OR d.document_type<>'balance' OR d.balance_role<>'closing') AND d.version_number=(SELECT MAX(current.version_number) FROM tax_documents current
           WHERE current.company_id=d.company_id AND current.tax_period_id=d.tax_period_id
             AND current.document_type=d.document_type
             AND (current.balance_role=d.balance_role OR (current.balance_role IS NULL AND d.balance_role IS NULL))
             AND current.status IN ('processed','superseded')
             AND current.discarded_at IS NULL)))
       ORDER BY d.document_type, d.version_number DESC`,
      [
        companyId,
        periodId,
        balanceDocumentId ?? null,
        balanceDocumentId ?? null,
        balanceDocumentId ?? null,
      ],
    )) as Row[];
    const toSource = (row: Row | undefined): ExplorerSource | null =>
      row
        ? {
            id: String(row.id),
            importId: row.importId == null ? null : String(row.importId),
            documentType: row.documentType as ExplorerSource["documentType"],
            versionNumber: Number(row.versionNumber),
            processedAt:
              row.processedAt === null
                ? null
                : new Date(String(row.processedAt)).toISOString(),
            balanceRole: row.balanceRole as ExplorerSource["balanceRole"],
          }
        : null;
    const bySource = new Map<string, ExplorerSource>();
    for (const row of rows) {
      const resolved = toSource(row);
      if (!resolved) continue;
      const key =
        resolved.documentType === "balance"
          ? `balance:${resolved.balanceRole}`
          : resolved.importId
            ? "general_ledger"
            : "unusable_general_ledger";
      if (!bySource.has(key)) bySource.set(key, resolved);
    }
    return {
      companyName: String(rows[0]?.companyName ?? ""),
      openingBalance: bySource.get("balance:opening") ?? null,
      closingBalance: bySource.get("balance:closing") ?? null,
      generalLedger: bySource.get("general_ledger") ?? null,
    };
  }

  async balance(
    companyId: string,
    periodId: string,
    query: BalanceExplorerQueryDto,
  ) {
    const period = (await this.periods.get(companyId, periodId)) as unknown as {
      commercialYear: number;
      taxYear: number;
    };
    const resolved = await this.resolveSources(
      companyId,
      periodId,
      query.balanceDocumentId,
    );
    const source = (row: ExplorerSource | null) =>
      row
        ? {
            id: row.id,
            versionNumber: row.versionNumber,
            processedAt: row.processedAt,
          }
        : null;
    const sources = {
      companyName: resolved.companyName,
      commercialYear: period.commercialYear,
      taxYear: period.taxYear,
      openingBalanceDocument: source(resolved.openingBalance),
      closingBalanceDocument: source(resolved.closingBalance),
      generalLedgerDocument: source(resolved.generalLedger),
    };
    const openingResult = await this.openingControl(
      companyId,
      periodId,
      period.commercialYear,
      resolved.openingBalance,
    );
    const { items: _openingItems, ...openingControl } = openingResult;
    const completionStatus = !resolved.openingBalance
      ? "missing_opening_balance"
      : !resolved.closingBalance
        ? "missing_closing_balance"
        : !resolved.generalLedger
          ? "missing_general_ledger"
          : openingControl.warning
            ? "accounting_review_with_warnings"
            : "ready_for_accounting_review";
    if (!resolved.closingBalance) {
      return {
        summary: this.emptySummary(false),
        sources,
        items: [],
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
        balanceAvailable: false,
        movementReconciliation: this.emptySummary(false),
        openingControl,
        completionStatus,
      };
    }
    const where = [
      "pa.company_id = ?",
      "pa.tax_period_id = ?",
      "pa.discarded_at IS NULL",
      "pa.source_document_id = ?",
    ];
    const params: unknown[] = [companyId, periodId, resolved.closingBalance.id];
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
    const sectionColumns: Record<string, string> = {
      asset: "asset_amount",
      liability: "liability_amount",
      loss: "loss_amount",
      gain: "gain_amount",
    };
    const effectiveSectionColumns: Record<string, string> = {
      asset: "effective_assets",
      liability: "effective_liabilities",
      loss: "effective_losses",
      gain: "effective_gains",
    };
    if (query.section) {
      const periodColumn = sectionColumns[query.section];
      const entryColumn = effectiveSectionColumns[query.section];
      where.push(`COALESCE(pa.${periodColumn}, be.${entryColumn}, 0) <> 0`);
    }
    const ledgerAvailable = Boolean(resolved.generalLedger?.importId);
    const ledgerJoin = ledgerAvailable
      ? `LEFT JOIN (SELECT e.company_account_id, CAST(SUM(e.debit) AS DECIMAL(24,4)) ledgerDebit,
          CAST(SUM(e.credit) AS DECIMAL(24,4)) ledgerCredit, COUNT(*) ledgerMovementCount,
          MAX(e.transaction_date) lastLedgerMovementDate
        FROM general_ledger_entries e
        WHERE e.general_ledger_import_id=? AND e.company_id=? AND e.tax_period_id=? GROUP BY e.company_account_id) l
        ON l.company_account_id=pa.company_account_id`
      : "LEFT JOIN (SELECT NULL company_account_id, NULL ledgerDebit, NULL ledgerCredit, 0 ledgerMovementCount, NULL lastLedgerMovementDate) l ON 1=0";
    const ledgerParams: unknown[] = ledgerAvailable
      ? [resolved.generalLedger!.importId, companyId, periodId]
      : [];
    const statusSql = ledgerAvailable
      ? `CASE WHEN COALESCE(l.ledgerMovementCount,0)=0 THEN 'no_ledger'
          WHEN ABS(COALESCE(pa.debit_amount, be.effective_debits, 0)-COALESCE(l.ledgerDebit,0))<=${RECONCILIATION_TOLERANCE}
           AND ABS(COALESCE(pa.credit_amount, be.effective_credits, 0)-COALESCE(l.ledgerCredit,0))<=${RECONCILIATION_TOLERANCE}
          THEN 'reconciled' ELSE 'difference' END`
      : "'unavailable'";
    const cte = `WITH explorer AS (SELECT pa.company_account_id accountId, pa.account_code_snapshot code,
      pa.account_name_snapshot name,
      ${coalescedBalanceAmount("debit_amount", "effective_debits", "balanceDebits")},
      ${coalescedBalanceAmount("credit_amount", "effective_credits", "balanceCredits")},
      ${coalescedBalanceAmount("debit_balance", "effective_debit_balance", "balanceDebitBalance")},
      ${coalescedBalanceAmount("credit_balance", "effective_credit_balance", "balanceCreditBalance")},
      ${coalescedBalanceAmount("asset_amount", "effective_assets", "balanceAssets")},
      ${coalescedBalanceAmount("liability_amount", "effective_liabilities", "balanceLiabilities")},
      ${coalescedBalanceAmount("loss_amount", "effective_losses", "balanceLosses")},
      ${coalescedBalanceAmount("gain_amount", "effective_gains", "balanceGains")},
      ${ledgerAvailable ? "COALESCE(l.ledgerDebit,0)" : "NULL"} ledgerDebit,
      ${ledgerAvailable ? "COALESCE(l.ledgerCredit,0)" : "NULL"} ledgerCredit,
      ${ledgerAvailable ? "COALESCE(pa.debit_amount, be.effective_debits, 0)-COALESCE(l.ledgerDebit,0)" : "NULL"} debitDifference,
      ${ledgerAvailable ? "COALESCE(pa.credit_amount, be.effective_credits, 0)-COALESCE(l.ledgerCredit,0)" : "NULL"} creditDifference,
      ${statusSql} reconciliationStatus, COALESCE(l.ledgerMovementCount,0) ledgerMovementCount,
      l.lastLedgerMovementDate, COALESCE(l.ledgerMovementCount,0)>0 hasLedgerMovements, TRUE canOpenLedger
      FROM tax_period_company_accounts pa
      LEFT JOIN balance_entries be ON be.id = pa.balance_entry_id
      ${ledgerJoin}
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
      debit: "balanceDebits",
      credit: "balanceCredits",
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
       SUM(reconciliationStatus='reconciled') reconciledAccounts,
       SUM(reconciliationStatus='difference') accountsWithDifferences,
       SUM(reconciliationStatus='no_ledger') accountsWithoutLedgerMovements,
       ${ledgerAvailable ? "FALSE" : "TRUE"} reconciliationUnavailable,
       CAST(COALESCE(SUM(balanceDebits),0) AS DECIMAL(24,4)) totalBalanceDebits,
       CAST(${ledgerAvailable ? "COALESCE(SUM(ledgerDebit),0)" : "NULL"} AS DECIMAL(24,4)) totalLedgerDebit,
       CAST(COALESCE(SUM(balanceCredits),0) AS DECIMAL(24,4)) totalBalanceCredits,
       CAST(${ledgerAvailable ? "COALESCE(SUM(ledgerCredit),0)" : "NULL"} AS DECIMAL(24,4)) totalLedgerCredit,
       CAST(${ledgerAvailable ? "COALESCE(SUM(debitDifference),0)" : "NULL"} AS DECIMAL(24,4)) totalDebitDifference,
       CAST(${ledgerAvailable ? "COALESCE(SUM(creditDifference),0)" : "NULL"} AS DECIMAL(24,4)) totalCreditDifference,
       CAST(COALESCE(SUM(balanceDebitBalance),0) AS DECIMAL(24,4)) totalBalanceDebitBalance,
       CAST(COALESCE(SUM(balanceCreditBalance),0) AS DECIMAL(24,4)) totalBalanceCreditBalance,
       CAST(COALESCE(SUM(balanceAssets),0) AS DECIMAL(24,4)) totalBalanceAssets,
       CAST(COALESCE(SUM(balanceLiabilities),0) AS DECIMAL(24,4)) totalBalanceLiabilities,
       CAST(COALESCE(SUM(balanceLosses),0) AS DECIMAL(24,4)) totalBalanceLosses,
       CAST(COALESCE(SUM(balanceGains),0) AS DECIMAL(24,4)) totalBalanceGains,
       CAST(SUM(balanceDebits)-SUM(balanceCredits) AS DECIMAL(24,4)) debitCreditDifference,
       SUM(balanceDebits)=SUM(balanceCredits) debitCreditBalanced,
       CAST(SUM(balanceDebitBalance)-SUM(balanceCreditBalance) AS DECIMAL(24,4)) debitCreditBalanceDifference,
       SUM(balanceDebitBalance)=SUM(balanceCreditBalance) debitCreditBalanceBalanced,
       CAST(SUM(balanceAssets)+SUM(balanceLosses) AS DECIMAL(24,4)) accountingEquationLeft,
       CAST(SUM(balanceLiabilities)+SUM(balanceGains) AS DECIMAL(24,4)) accountingEquationRight,
       CAST((SUM(balanceAssets)+SUM(balanceLosses))-(SUM(balanceLiabilities)+SUM(balanceGains)) AS DECIMAL(24,4)) accountingEquationDifference,
       (SUM(balanceAssets)+SUM(balanceLosses))=(SUM(balanceLiabilities)+SUM(balanceGains)) accountingEquationBalanced,
       CAST(ABS(SUM(balanceGains)-SUM(balanceLosses)) AS DECIMAL(24,4)) netResultAmount,
       CASE WHEN SUM(balanceGains)>SUM(balanceLosses) THEN 'profit' WHEN SUM(balanceGains)<SUM(balanceLosses) THEN 'loss' ELSE 'zero' END netResultType,
       SUM(balanceAssets<>0) assetAccountCount, SUM(balanceLiabilities<>0) liabilityAccountCount,
       SUM(balanceLosses<>0) lossAccountCount, SUM(balanceGains<>0) gainAccountCount FROM explorer`,
      [...ledgerParams, ...params],
    )) as Row[];
    const rawSummary = ledgerAvailable
      ? (summaries[0] ?? this.emptySummary(true))
      : {
          ...(summaries[0] ?? this.emptySummary(false)),
          reconciledAccounts: 0,
          accountsWithDifferences: 0,
          accountsWithoutLedgerMovements: 0,
          reconciliationUnavailable: true,
          totalLedgerDebit: null,
          totalLedgerCredit: null,
          totalDebitDifference: null,
          totalCreditDifference: null,
        };
    const normalized = rawSummary as Row;
    const summary: Row & {
      totalAccounts: number;
      reconciledAccounts: number;
      accountsWithDifferences: number;
      accountsWithoutLedgerMovements: number;
      reconciliationUnavailable: boolean;
    } = {
      ...normalized,
      totalAccounts: Number(normalized.totalAccounts ?? 0),
      reconciledAccounts: Number(normalized.reconciledAccounts ?? 0),
      accountsWithDifferences: Number(normalized.accountsWithDifferences ?? 0),
      accountsWithoutLedgerMovements: Number(
        normalized.accountsWithoutLedgerMovements ?? 0,
      ),
      reconciliationUnavailable: Boolean(
        Number(normalized.reconciliationUnavailable ?? 0),
      ),
      debitCreditBalanced: Boolean(Number(normalized.debitCreditBalanced ?? 0)),
      debitCreditBalanceBalanced: Boolean(
        Number(normalized.debitCreditBalanceBalanced ?? 0),
      ),
      accountingEquationBalanced: Boolean(
        Number(normalized.accountingEquationBalanced ?? 0),
      ),
      assetAccountCount: Number(normalized.assetAccountCount ?? 0),
      liabilityAccountCount: Number(normalized.liabilityAccountCount ?? 0),
      lossAccountCount: Number(normalized.lossAccountCount ?? 0),
      gainAccountCount: Number(normalized.gainAccountCount ?? 0),
    };
    return {
      summary,
      movementReconciliation: summary,
      openingControl,
      completionStatus,
      sources,
      items: rows.map(({ total: _, ...row }) => {
        const normalizedRow: Row & {
          ledgerMovementCount: number;
          hasLedgerMovements: boolean;
          canOpenLedger: boolean;
        } = {
          ...normalizeBalanceItem(row),
          ledgerMovementCount: Number(row.ledgerMovementCount ?? 0),
          hasLedgerMovements: Boolean(Number(row.hasLedgerMovements ?? 0)),
          canOpenLedger: Boolean(Number(row.canOpenLedger ?? 0)),
        };
        return normalizedRow;
      }),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(rows[0]?.total ?? 0),
      balanceAvailable: true,
    };
  }

  private async openingControl(
    companyId: string,
    periodId: string,
    commercialYear: number,
    opening: ExplorerSource | null,
  ) {
    const unavailable = (
      openingAvailable: boolean,
      previousClosingAvailable = false,
    ) => ({
      openingBalanceAvailable: openingAvailable,
      previousClosingAvailable,
      matchingAccounts: 0,
      accountsWithDifferences: 0,
      onlyInOpening: 0,
      onlyInPreviousClosing: 0,
      warning: null,
      items: [],
    });
    if (!opening) return unavailable(false);
    const previous = (await this.db.query(
      `SELECT d.id FROM tax_periods p JOIN tax_documents d ON d.tax_period_id=p.id AND d.company_id=p.company_id
       WHERE p.company_id=? AND p.commercial_year=? AND d.document_type='balance' AND d.balance_role='closing'
         AND d.status='processed' AND d.discarded_at IS NULL
       ORDER BY d.version_number DESC LIMIT 1`,
      [companyId, commercialYear - 1],
    )) as Row[];
    if (!previous[0]) return unavailable(true);
    const rows = (await this.db.query(
      `WITH compared AS (
       SELECT COALESCE(o.company_account_id, pc.company_account_id) companyAccountId,
        COALESCE(o.account_code, pc.account_code) code, o.account_name openingName, pc.account_name previousClosingName,
        o.reported_debit_balance openingDebitBalance, o.reported_credit_balance openingCreditBalance,
        pc.reported_debit_balance previousClosingDebitBalance, pc.reported_credit_balance previousClosingCreditBalance
       FROM (SELECT e.* FROM balance_entries e JOIN balance_imports i ON i.id=e.balance_import_id WHERE i.tax_document_id=? AND e.company_id=? AND e.tax_period_id=?) o
       LEFT JOIN (SELECT e.* FROM balance_entries e JOIN balance_imports i ON i.id=e.balance_import_id WHERE i.tax_document_id=? AND e.company_id=?) pc
         ON (o.company_account_id IS NOT NULL AND o.company_account_id=pc.company_account_id) OR ((o.company_account_id IS NULL OR pc.company_account_id IS NULL) AND o.account_code=pc.account_code)
       UNION ALL
       SELECT pc.company_account_id, pc.account_code, NULL, pc.account_name, NULL, NULL, pc.reported_debit_balance, pc.reported_credit_balance
       FROM balance_entries pc JOIN balance_imports i ON i.id=pc.balance_import_id
       WHERE i.tax_document_id=? AND pc.company_id=? AND NOT EXISTS (SELECT 1 FROM balance_entries o JOIN balance_imports oi ON oi.id=o.balance_import_id WHERE oi.tax_document_id=? AND o.company_id=? AND o.tax_period_id=? AND ((o.company_account_id IS NOT NULL AND o.company_account_id=pc.company_account_id) OR ((o.company_account_id IS NULL OR pc.company_account_id IS NULL) AND o.account_code=pc.account_code))))
       SELECT compared.*,
         CASE WHEN openingName IS NULL THEN 'only_in_previous_closing'
              WHEN previousClosingName IS NULL THEN 'only_in_opening'
              WHEN ABS(COALESCE(openingDebitBalance,0)-COALESCE(previousClosingDebitBalance,0))<=${RECONCILIATION_TOLERANCE}
               AND ABS(COALESCE(openingCreditBalance,0)-COALESCE(previousClosingCreditBalance,0))<=${RECONCILIATION_TOLERANCE}
              THEN 'matching' ELSE 'difference' END status,
         CASE WHEN openingName IS NULL OR previousClosingName IS NULL THEN NULL ELSE CAST(COALESCE(openingDebitBalance,0)-COALESCE(previousClosingDebitBalance,0) AS DECIMAL(24,4)) END debitDifference,
         CASE WHEN openingName IS NULL OR previousClosingName IS NULL THEN NULL ELSE CAST(COALESCE(openingCreditBalance,0)-COALESCE(previousClosingCreditBalance,0) AS DECIMAL(24,4)) END creditDifference
       FROM compared`,
      [
        opening.id,
        companyId,
        periodId,
        previous[0].id,
        companyId,
        previous[0].id,
        companyId,
        opening.id,
        companyId,
        periodId,
      ],
    )) as Row[];
    const items = rows;
    const count = (status: string) =>
      items.filter((item) => item.status === status).length;
    const differing =
      count("difference") +
      count("only_in_opening") +
      count("only_in_previous_closing");
    return {
      openingBalanceAvailable: true,
      previousClosingAvailable: true,
      matchingAccounts: count("matching"),
      accountsWithDifferences: count("difference"),
      onlyInOpening: count("only_in_opening"),
      onlyInPreviousClosing: count("only_in_previous_closing"),
      warning: differing
        ? "El Balance inicial informado difiere del Balance final almacenado del período anterior. Revise las diferencias. JivaTax no modificará automáticamente la información proporcionada."
        : null,
      items,
    };
  }

  async openingControlDetail(
    companyId: string,
    periodId: string,
    query: OpeningControlQueryDto,
  ) {
    const period = (await this.periods.get(companyId, periodId)) as unknown as {
      commercialYear: number;
    };
    const sources = await this.resolveSources(companyId, periodId);
    const result = await this.openingControl(
      companyId,
      periodId,
      period.commercialYear,
      sources.openingBalance,
    );
    let items = result.items;
    if (query.search) {
      const search = query.search.toLocaleLowerCase("es-CL");
      items = items.filter((item) =>
        [item.code, item.openingName, item.previousClosingName].some((value) =>
          String(value ?? "")
            .toLocaleLowerCase("es-CL")
            .includes(search),
        ),
      );
    }
    if (query.status)
      items = items.filter((item) => item.status === query.status);
    const compare = (left: Row, right: Row) =>
      String(left[query.sort] ?? "").localeCompare(
        String(right[query.sort] ?? ""),
        "es-CL",
        { numeric: true },
      );
    items.sort((left, right) =>
      query.direction === "asc" ? compare(left, right) : compare(right, left),
    );
    const total = items.length;
    const offset = (query.page - 1) * query.pageSize;
    return {
      items: items.slice(offset, offset + query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      total,
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
      totalBalanceDebits: "0.0000",
      totalBalanceCredits: "0.0000",
      totalBalanceDebitBalance: "0.0000",
      totalBalanceCreditBalance: "0.0000",
      totalBalanceAssets: "0.0000",
      totalBalanceLiabilities: "0.0000",
      totalBalanceLosses: "0.0000",
      totalBalanceGains: "0.0000",
      debitCreditDifference: "0.0000",
      debitCreditBalanced: true,
      debitCreditBalanceDifference: "0.0000",
      debitCreditBalanceBalanced: true,
      accountingEquationLeft: "0.0000",
      accountingEquationRight: "0.0000",
      accountingEquationDifference: "0.0000",
      accountingEquationBalanced: true,
      netResultAmount: "0.0000",
      netResultType: "zero" as const,
      assetAccountCount: 0,
      liabilityAccountCount: 0,
      lossAccountCount: 0,
      gainAccountCount: 0,
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
    const resolved = await this.resolveSources(companyId, periodId);
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
      "e.general_ledger_import_id = ?",
    ];
    const params: unknown[] = [
      companyId,
      periodId,
      accountId,
      resolved.generalLedger?.importId ?? "",
    ];
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
        FROM general_ledger_entries e
        WHERE ${where.join(" AND ")}) filtered
      ORDER BY ${sort[query.sort]} ${query.direction.toUpperCase()}, id ASC LIMIT ? OFFSET ?`;
    const rows = (await this.db.query(sql, [
      ...params,
      query.pageSize,
      offset,
    ])) as Row[];
    return {
      account: accounts[0],
      generalLedgerAvailable: Boolean(resolved.generalLedger?.importId),
      items: rows.map(({ total: _, ...row }) => row),
      page: query.page,
      pageSize: query.pageSize,
      total: Number(rows[0]?.total ?? 0),
    };
  }
}

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BalanceRole,
  TaxDocumentStatus,
  TaxDocumentType,
} from "../enums/accounting.enums";
import { TaxDocumentsService } from "./tax-documents.service";

type QueryCall = { sql: string; parameters: unknown[] };

function serviceHarness() {
  const calls: QueryCall[] = [];
  const saved: Record<string, unknown>[] = [];
  const manager = {
    async query(sql: string, parameters: unknown[] = []) {
      calls.push({ sql, parameters });
      if (sql.startsWith("SELECT id, internal_code"))
        return [{ id: "account-id", internal_code: "1.01" }];
      return [];
    },
    async save(value: Record<string, unknown>) {
      saved.push({ ...value });
      return value;
    },
    async findOne() {
      return null;
    },
  };
  const dataSource = {
    async transaction(
      callback: (transactionManager: typeof manager) => Promise<void>,
    ) {
      await callback(manager);
    },
  };
  const service = new TaxDocumentsService(
    {} as never,
    {} as never,
    dataSource as never,
    {} as never,
    {} as never,
  );
  return { service, calls, saved };
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    rowsRead: 2,
    validRows: 2,
    ignoredRows: 0,
    errors: [],
    warnings: [],
    totals: { debit: 100, credit: 100 },
    reconciliation: {},
    detectedSheet: "Datos",
    headerRowNumber: 1,
    duplicateKeys: [],
    detectedColumns: {},
    ...overrides,
  };
}

type TestReport = ReturnType<typeof report>;

describe("persistencia normalizada de movimientos", () => {
  it("publica el cierre completo y luego descarta las cuentas ausentes de la fotografía anterior", async () => {
    const { service, calls } = serviceHarness();
    const money = Object.fromEntries(
      [
        "debits",
        "credits",
        "debitBalance",
        "creditBalance",
        "assets",
        "liabilities",
        "losses",
        "gains",
      ].map((field) => [
        field,
        { reportedValue: "0.0000", effectiveValue: "0.0000", wasBlank: false },
      ]),
    );
    await (
      service as unknown as {
        persistBalance(
          manager: unknown,
          document: Record<string, unknown>,
          importId: string,
          rows: Record<string, unknown>[],
          report: TestReport,
          operational: boolean,
        ): Promise<void>;
      }
    ).persistBalance(
      {
        query: async (sql: string, parameters: unknown[] = []) => {
          calls.push({ sql, parameters });
          if (sql.includes("SELECT id, name FROM company_accounts"))
            return [{ id: "account-id", name: "Caja" }];
          return [];
        },
      },
      {
        id: "closing-v2",
        companyId: "company",
        taxPeriodId: "period",
        documentType: TaxDocumentType.BALANCE,
        balanceRole: BalanceRole.CLOSING,
      },
      "import-v2",
      [
        {
          rowType: "account",
          sourceRowNumber: 2,
          sheetName: "Datos",
          accountCode: "1.01",
          accountName: "Caja",
          rawData: [],
          money,
          calculatedDebitBalance: "0.0000",
          calculatedCreditBalance: "0.0000",
        },
      ],
      report({ detectedColumns: {} }),
      true,
    );
    const discard = calls.findIndex((call) =>
      call.sql.includes("UPDATE tax_period_company_accounts"),
    );
    const publish = calls.findIndex((call) =>
      call.sql.includes("INSERT INTO tax_period_company_accounts"),
    );
    assert.ok(publish >= 0 && discard > publish);
    assert.match(calls[discard].sql, /discarded_at=NOW/);
    assert.match(calls[discard].sql, /source_document_id<>\?/);
    assert.match(calls[publish].sql, /discarded_at=NULL/);
    assert.match(calls[publish].sql, /discarded_by_document_id=NULL/);
    assert.equal(
      calls.some((call) => call.sql.includes("DELETE FROM balance_entries")),
      false,
    );
  });
  it("mantiene el primer nombre en company_accounts y conserva el nombre de cada período como snapshot", () => {
    const source = readFileSync(
      join(__dirname, "tax-documents.service.ts"),
      "utf8",
    );
    assert.match(
      source,
      /INSERT INTO company_accounts \(id, company_id, internal_code, name/,
    );
    assert.match(
      source,
      /UPDATE company_accounts SET last_seen_tax_period_id = \?, last_seen_at = NOW\(6\), updated_at = NOW\(6\) WHERE id = \?/,
    );
    assert.doesNotMatch(source, /UPDATE company_accounts SET name =/);
    assert.match(
      source,
      /account_name_snapshot=VALUES\(account_name_snapshot\)/,
    );
    assert.match(source, /code: "ACCOUNT_NAME_CHANGED"/);
  });

  it("persiste encabezado y todas las filas del Mayor antes de marcar procesado", async () => {
    const { service, calls, saved } = serviceHarness();
    const document = {
      id: "ledger-document",
      companyId: "company",
      taxPeriodId: "period",
      documentType: TaxDocumentType.GENERAL_LEDGER,
      status: TaxDocumentStatus.PROCESSING,
      versionNumber: 1,
    };
    const rows = [1, 2].map((sourceRowNumber) => ({
      accountCode: "1.01",
      accountName: "Banco",
      date: "2025-01-01",
      documentType: "FAC",
      documentNumber: String(sourceRowNumber),
      description: "Movimiento",
      debit: sourceRowNumber === 1 ? 100 : 0,
      credit: sourceRowNumber === 2 ? 100 : 0,
      sourceRowNumber,
      rawData: [],
    }));
    await (
      service as unknown as {
        persist(
          document: Record<string, unknown>,
          rows: Record<string, unknown>[],
          report: TestReport,
        ): Promise<void>;
      }
    ).persist(document, rows, report());

    const header = calls.find((call) =>
      call.sql.includes("INSERT INTO general_ledger_imports"),
    );
    const entries = calls.filter((call) =>
      call.sql.includes("INSERT INTO general_ledger_entries"),
    );
    assert.ok(header);
    assert.equal(entries.length, 2);
    assert.equal(entries[0].parameters[1], entries[1].parameters[1]);
    assert.equal(entries[0].parameters[1], header.parameters[0]);
    assert.equal(entries[0].parameters[4], "account-id");
    assert.equal(saved.at(-1)?.status, TaxDocumentStatus.PROCESSED);
  });

  it("persiste filas y métricas de comprobantes del Diario", async () => {
    const { service, calls, saved } = serviceHarness();
    const document = {
      id: "journal-document",
      companyId: "company",
      taxPeriodId: "period",
      documentType: TaxDocumentType.JOURNAL,
      status: TaxDocumentStatus.PROCESSING,
      versionNumber: 1,
    };
    const rows = [1, 2].map((sequence) => ({
      date: "2025-01-01",
      voucherNumber: "0001",
      sequence,
      accountCode: "1.01",
      description: "Asiento",
      debit: sequence === 1 ? 100 : 0,
      credit: sequence === 2 ? 100 : 0,
      sourceRowNumber: sequence,
      rawData: [],
    }));
    await (
      service as unknown as {
        persist(
          document: Record<string, unknown>,
          rows: Record<string, unknown>[],
          report: TestReport,
        ): Promise<void>;
      }
    ).persist(
      document,
      rows,
      report({
        voucherCount: 1,
        balancedVoucherCount: 1,
        unbalancedVoucherCount: 0,
      }),
    );

    assert.equal(
      calls.filter((call) => call.sql.includes("INSERT INTO journal_entries"))
        .length,
      2,
    );
    assert.ok(
      calls.some((call) =>
        call.sql.startsWith("UPDATE journal_imports SET vouchers_read"),
      ),
    );
    assert.equal(saved.at(-1)?.status, TaxDocumentStatus.PROCESSED);
    assert.equal(
      calls.some((call) => call.sql.includes("INSERT INTO company_accounts")),
      false,
    );
  });
});

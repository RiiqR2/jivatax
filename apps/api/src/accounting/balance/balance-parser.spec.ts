import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import {
  BalanceRowType,
  classifyBalanceRow,
  interpretBalanceMoney,
  parseBalanceRows,
} from "./balance-parser";
import {
  DOCUMENT_CONTRACTS,
  resolveRequiredHeaders,
} from "../contracts/document-contracts";
import { TaxDocumentType } from "../enums/accounting.enums";

const columns = {
  accountCode: 0,
  accountName: 1,
  debits: 2,
  credits: 3,
  debitBalance: 4,
  creditBalance: 5,
  assets: 6,
  liabilities: 7,
  losses: 8,
  gains: 9,
};

describe("Balance de ocho columnas", () => {
  it("resuelve las cabeceras reales con guiones bajos, Debe/Haber y tildes", () => {
    const result = resolveRequiredHeaders(
      [
        "codigo_cuenta",
        "nombre_cuenta",
        "Debe",
        "Haber",
        "Saldo Deudor",
        "Saldo Acreedor",
        "Activo",
        "Pasivo",
        "Pérdida",
        "Ganancia",
      ],
      DOCUMENT_CONTRACTS[TaxDocumentType.BALANCE],
    );
    assert.deepEqual(result.missingFields, []);
    assert.deepEqual(result.duplicates, []);
    assert.deepEqual(result.map, columns);
  });

  it("detecta alias duplicado y columnas obligatorias ausentes", () => {
    const duplicate = resolveRequiredHeaders(
      ["codigo_cuenta", "Código de cuenta"],
      DOCUMENT_CONTRACTS[TaxDocumentType.BALANCE],
    );
    assert.deepEqual(duplicate.duplicates, [
      { field: "accountCode", columns: [0, 1] },
    ]);
    assert.ok(duplicate.missingFields.includes("creditBalance"));
    assert.ok(duplicate.missingFields.includes("gains"));
  });

  it("separa cuentas y resúmenes, conserva decimales y valida total y rollup", () => {
    const result = parseBalanceRows(
      [
        Object.keys(columns),
        [
          "001.01-2",
          "Caja",
          "999999999999.1234",
          0,
          "999999999999.1234",
          null,
          "999999999999.1234",
          null,
          null,
          null,
        ],
        [
          "200",
          "Capital",
          0,
          "999999999999.1234",
          null,
          "999999999999.1234",
          null,
          null,
          null,
          "999999999999.1234",
        ],
        [
          null,
          "Subtotal",
          "999999999999.1234",
          "999999999999.1234",
          "999999999999.1234",
          "999999999999.1234",
          "999999999999.1234",
          null,
          null,
          "999999999999.1234",
        ],
        [null, "Ganancia (pérd.) ej.fiscal", 0, 0, 0, 0, 0, 0, 0, 0],
        [
          null,
          "Total empresa",
          "999999999999.1234",
          "999999999999.1234",
          "999999999999.1234",
          "999999999999.1234",
          "999999999999.1234",
          null,
          null,
          "999999999999.1234",
        ],
      ],
      0,
      columns,
      "Balance",
    );
    assert.equal(
      result.rows.filter((row) => row.rowType === "account").length,
      2,
    );
    assert.equal(result.reportedSummaries.length, 3);
    assert.equal(result.rows[0].accountCode, "001.01-2");
    assert.equal(result.systemTotals.debits, "999999999999.1234");
    assert.equal(result.accountingChecks.reportedTotalMatchesCalculated, true);
    assert.equal(result.accountingChecks.reportedRollupMatches, true);
  });

  it("genera warnings por total y rollup informados sin alterar las cuentas", () => {
    const result = parseBalanceRows(
      [
        Object.keys(columns),
        ["100", "Caja", 10, 10, 0, 0, 0, 0, 0, 0],
        [null, "Subtotal", 10, 10, 0, 0, 0, 0, 0, 0],
        [null, "Resultado del ejercicio", 0, 0, 0, 0, 0, 0, 0, 0],
        [null, "Total empresa", 11, 10, 0, 0, 0, 0, 0, 0],
      ],
      0,
      columns,
      "Balance",
    );
    assert.ok(
      result.warnings.some((issue) => issue.code === "REPORTED_TOTAL_MISMATCH"),
    );
    assert.ok(
      result.warnings.some(
        (issue) => issue.code === "REPORTED_SUMMARY_ROLLUP_MISMATCH",
      ),
    );
    assert.equal(
      result.rows.filter((row) => row.rowType === "account").length,
      1,
    );
  });
  it("distingue una celda vacía de un cero explícito", () => {
    const blank = interpretBalanceMoney(null, 2, "debits");
    const zero = interpretBalanceMoney(0, 2, "debits");

    assert.equal(blank.reportedValue, null);
    assert.equal(blank.effectiveValue, 0);
    assert.equal(blank.wasBlank, true);
    assert.equal(zero.reportedValue, 0);
    assert.equal(zero.effectiveValue, 0);
    assert.equal(zero.wasBlank, false);
  });

  it("rechaza texto monetario sin convertirlo silenciosamente", () => {
    const value = interpretBalanceMoney("sin monto", 3, "credits");
    assert.equal(value.error?.code, "INVALID_NUMBER");
    assert.equal(value.reportedValue, null);
  });

  it("clasifica filas de resumen conservando sus nombres", () => {
    assert.equal(
      classifyBalanceRow(null, "SUMA", [null, "SUMA", 10]),
      BalanceRowType.SUBTOTAL,
    );
    assert.equal(
      classifyBalanceRow(null, "RESULTADO DEL EJERCICIO", [
        null,
        "RESULTADO DEL EJERCICIO",
        10,
      ]),
      BalanceRowType.RESULT,
    );
    assert.equal(
      classifyBalanceRow(null, "TOTALES", [null, "TOTALES", 10]),
      BalanceRowType.TOTAL,
    );
  });

  it("solo detecta duplicados entre cuentas con código real", () => {
    const result = parseBalanceRows(
      [
        Object.keys(columns),
        ["100", "Caja", 10, 0, 10, null, 10, null, null, null],
        [null, "TOTAL", 10, 0, 10, null, 10, null, null, null],
        [null, "TOTALES", 10, 0, 10, null, 10, null, null, null],
      ],
      0,
      columns,
      "Balance",
    );

    assert.deepEqual(
      [...result.errors, ...result.warnings].filter((issue) =>
        issue.code.startsWith("DUPLICATE"),
      ),
      [],
    );
    assert.equal(result.rows[1].rowType, BalanceRowType.TOTAL);
    assert.equal(result.reportedTotals?.debits, "10.0000");
    assert.equal(result.systemTotals.debits, "10.0000");
  });

  it("conserva saldo informado y alerta al compararlo con el calculado", () => {
    const result = parseBalanceRows(
      [
        Object.keys(columns),
        ["100", "Caja", 10, 2, 7, null, 7, null, null, null],
      ],
      0,
      columns,
      "Balance",
    );
    const account = result.rows[0];

    assert.equal(account.money.debitBalance.reportedValue, 7);
    assert.equal(account.calculatedDebitBalance, "8.0000");
    assert.ok(
      result.warnings.some((issue) => issue.code === "DEBIT_BALANCE_MISMATCH"),
    );
  });

  it("procesa cuentas válidas con montos alternados vacíos", () => {
    const result = parseBalanceRows(
      [
        Object.keys(columns),
        ["100", "Caja", 10, null, 10, null, 10, null, null, null],
        ["200", "Proveedores", null, 10, null, 10, null, 10, null, null],
      ],
      0,
      columns,
      "Balance",
    );

    assert.equal(result.errors.length, 0);
    assert.equal(
      result.rows.filter((row) => row.rowType === "account").length,
      2,
    );
    assert.equal(result.reconciliation.movements.isBalanced, true);
  });

  it("procesa la fixture anonimizada y conserva cuentas y resúmenes", () => {
    const workbook = XLSX.readFile(
      `${__dirname}/fixtures/anonymous-eight-column-balance.csv`,
      { raw: true },
    );
    const sheetName = workbook.SheetNames[0];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(
      workbook.Sheets[sheetName],
      { header: 1, raw: true, defval: null },
    );
    const result = parseBalanceRows(matrix, 0, columns, sheetName);

    assert.equal(result.errors.length, 0);
    assert.equal(
      result.rows.filter((row) => row.rowType === BalanceRowType.ACCOUNT)
        .length,
      4,
    );
    assert.equal(
      result.rows.filter((row) =>
        [
          BalanceRowType.SUBTOTAL,
          BalanceRowType.RESULT,
          BalanceRowType.TOTAL,
        ].includes(row.rowType),
      ).length,
      3,
    );
    assert.equal(result.reportedTotals?.debits, "200000.0000");
    assert.equal(result.systemTotals.debits, "200000.0000");
    assert.equal(result.reconciliation.movements.isBalanced, true);
  });
});

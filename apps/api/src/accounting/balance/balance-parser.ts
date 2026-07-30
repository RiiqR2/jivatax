import { normalizeHeader } from "../contracts/document-contracts";

export enum BalanceRowType {
  ACCOUNT = "account",
  SUBTOTAL = "subtotal",
  RESULT = "result",
  TOTAL = "total",
  NOTE = "note",
  EMPTY = "empty",
  UNKNOWN = "unknown",
}

export const BALANCE_MONETARY_FIELDS = [
  "debits",
  "credits",
  "debitBalance",
  "creditBalance",
  "assets",
  "liabilities",
  "losses",
  "gains",
] as const;

export type BalanceMonetaryField = (typeof BALANCE_MONETARY_FIELDS)[number];

export type BalanceIssue = {
  sourceRowNumber: number;
  field: string;
  code: string;
  message: string;
  rawValue: unknown;
};

export type InterpretedMoney = {
  reportedValue: number | null;
  effectiveValue: number;
  wasBlank: boolean;
  error?: BalanceIssue;
  warning?: BalanceIssue;
};

export type BalanceParsedRow = {
  sourceRowNumber: number;
  sheetName: string;
  rowType: BalanceRowType;
  accountCode: string | null;
  accountName: string | null;
  rawData: unknown[];
  money: Record<BalanceMonetaryField, InterpretedMoney>;
  calculatedDebitBalance: number | null;
  calculatedCreditBalance: number | null;
};

export type BalanceTotals = Record<BalanceMonetaryField, number>;

export type BalanceComparison = {
  field: BalanceMonetaryField;
  reported: number | null;
  calculated: number;
  difference: number | null;
  status: "matched" | "mismatched" | "not_reported";
};

const emptyTotals = (): BalanceTotals => ({
  debits: 0,
  credits: 0,
  debitBalance: 0,
  creditBalance: 0,
  assets: 0,
  liabilities: 0,
  losses: 0,
  gains: 0,
});

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

export function classifyBalanceRow(
  accountCodeRaw: unknown,
  accountNameRaw: unknown,
  relevantCells: unknown[],
): BalanceRowType {
  if (relevantCells.every(isBlank)) return BalanceRowType.EMPTY;
  const codePresent = !isBlank(accountCodeRaw);
  const namePresent = !isBlank(accountNameRaw);
  const comparableName = normalizeHeader(accountNameRaw).toUpperCase();

  if (
    !codePresent &&
    /RESULTADO DEL EJERCICIO|UTILIDAD DEL EJERCICIO|PERDIDA DEL EJERCICIO/.test(
      comparableName,
    )
  )
    return BalanceRowType.RESULT;
  if (!codePresent && /(^|\s)(SUMA|SUBTOTAL)(\s|$)/.test(comparableName))
    return BalanceRowType.SUBTOTAL;
  if (!codePresent && /(^|\s)TOTAL(ES)?( GENERAL)?(\s|$)/.test(comparableName))
    return BalanceRowType.TOTAL;
  if (codePresent || namePresent) {
    if (codePresent && namePresent) return BalanceRowType.ACCOUNT;
    if (!codePresent && namePresent && relevantCells.slice(2).every(isBlank))
      return BalanceRowType.NOTE;
    return BalanceRowType.UNKNOWN;
  }
  return BalanceRowType.UNKNOWN;
}

export function interpretBalanceMoney(
  rawValue: unknown,
  sourceRowNumber: number,
  field: BalanceMonetaryField,
): InterpretedMoney {
  if (isBlank(rawValue))
    return { reportedValue: null, effectiveValue: 0, wasBlank: true };

  let value: number;
  if (typeof rawValue === "number") value = rawValue;
  else {
    const rawText = String(rawValue).trim();
    const normalized = /^-?\d{1,3}(\.\d{3})+$/.test(rawText)
      ? rawText.replaceAll(".", "")
      : rawText;
    value = Number(normalized);
  }
  if (!Number.isFinite(value))
    return {
      reportedValue: null,
      effectiveValue: 0,
      wasBlank: false,
      error: {
        sourceRowNumber,
        field,
        code: "INVALID_NUMBER",
        message: "El valor monetario no se puede interpretar.",
        rawValue,
      },
    };
  return {
    reportedValue: value,
    effectiveValue: value,
    wasBlank: false,
    warning:
      value < 0
        ? {
            sourceRowNumber,
            field,
            code: "NEGATIVE_AMOUNT",
            message: "El valor monetario negativo requiere revisión.",
            rawValue,
          }
        : undefined,
  };
}

export function parseBalanceRows(
  matrix: unknown[][],
  headerRowIndex: number,
  columnMap: Record<string, number>,
  sheetName: string,
  tolerance = 0,
) {
  const errors: BalanceIssue[] = [];
  const warnings: BalanceIssue[] = [];
  const rows: BalanceParsedRow[] = [];
  const seen = new Map<string, BalanceParsedRow>();

  matrix.slice(headerRowIndex + 1).forEach((source, offset) => {
    const sourceRowNumber = headerRowIndex + offset + 2;
    const raw = (field: string) => source[columnMap[field]];
    const accountCodeRaw = raw("accountCode");
    const accountNameRaw = raw("accountName");
    const relevant = [
      accountCodeRaw,
      accountNameRaw,
      ...BALANCE_MONETARY_FIELDS.map(raw),
    ];
    const rowType = classifyBalanceRow(
      accountCodeRaw,
      accountNameRaw,
      relevant,
    );
    const money = Object.fromEntries(
      BALANCE_MONETARY_FIELDS.map((field) => {
        const interpreted = interpretBalanceMoney(
          raw(field),
          sourceRowNumber,
          field,
        );
        if (interpreted.error) errors.push(interpreted.error);
        if (interpreted.warning) warnings.push(interpreted.warning);
        return [field, interpreted];
      }),
    ) as Record<BalanceMonetaryField, InterpretedMoney>;
    const accountCode = isBlank(accountCodeRaw)
      ? null
      : String(accountCodeRaw).trim();
    const accountName = isBlank(accountNameRaw)
      ? null
      : String(accountNameRaw).trim().replace(/\s+/g, " ");
    const row: BalanceParsedRow = {
      sourceRowNumber,
      sheetName,
      rowType,
      accountCode,
      accountName,
      rawData: source,
      money,
      calculatedDebitBalance: null,
      calculatedCreditBalance: null,
    };
    rows.push(row);

    if (rowType === BalanceRowType.UNKNOWN) {
      warnings.push({
        sourceRowNumber,
        field: "row",
        code: "UNKNOWN_BALANCE_ROW",
        message:
          "Fila con información no clasificable; fue conservada para revisión.",
        rawValue: source,
      });
      return;
    }
    if (rowType !== BalanceRowType.ACCOUNT || !accountCode) return;

    row.calculatedDebitBalance = Math.max(
      money.debits.effectiveValue - money.credits.effectiveValue,
      0,
    );
    row.calculatedCreditBalance = Math.max(
      money.credits.effectiveValue - money.debits.effectiveValue,
      0,
    );
    compareAccountBalance(
      row,
      "debitBalance",
      row.calculatedDebitBalance,
      tolerance,
      warnings,
    );

    const hasBalance =
      money.debitBalance.effectiveValue > tolerance ||
      money.creditBalance.effectiveValue > tolerance;
    const classifiedAmount =
      money.assets.effectiveValue +
      money.liabilities.effectiveValue +
      money.losses.effectiveValue +
      money.gains.effectiveValue;
    if (hasBalance && Math.abs(classifiedAmount) <= tolerance) {
      const unclassifiedDifference =
        money.debitBalance.effectiveValue || money.creditBalance.effectiveValue;
      errors.push({
        sourceRowNumber,
        field: "classification",
        code: "UNCLASSIFIED_ACCOUNT_BALANCE",
        message:
          "La cuenta tiene saldo, pero no informa Activo, Pasivo, Pérdidas ni Ganancias.",
        rawValue: {
          accountCode,
          accountName,
          debitBalance: money.debitBalance.reportedValue,
          creditBalance: money.creditBalance.reportedValue,
          assets: money.assets.reportedValue,
          liabilities: money.liabilities.reportedValue,
          losses: money.losses.reportedValue,
          gains: money.gains.reportedValue,
          unclassifiedDifference,
        },
      });
    }
    compareAccountBalance(
      row,
      "creditBalance",
      row.calculatedCreditBalance,
      tolerance,
      warnings,
    );

    const previous = seen.get(accountCode);
    if (previous) {
      const identical = accountSignature(previous) === accountSignature(row);
      (identical ? warnings : errors).push({
        sourceRowNumber,
        field: "accountCode",
        code: identical
          ? "DUPLICATE_ACCOUNT_IDENTICAL"
          : "DUPLICATE_ACCOUNT_CONFLICT",
        message: identical
          ? "Cuenta repetida con el mismo nombre y valores."
          : "Cuenta repetida con nombre o valores diferentes.",
        rawValue: accountCode,
      });
    } else seen.set(accountCode, row);
  });

  const accountRows = rows.filter(
    (row) => row.rowType === BalanceRowType.ACCOUNT,
  );
  const systemTotals = emptyTotals();
  for (const row of accountRows)
    for (const field of BALANCE_MONETARY_FIELDS)
      systemTotals[field] += row.money[field].effectiveValue;
  const totalRow = [...rows]
    .reverse()
    .find((row) => row.rowType === BalanceRowType.TOTAL);
  const reportedTotals = totalRow
    ? (Object.fromEntries(
        BALANCE_MONETARY_FIELDS.map((field) => [
          field,
          totalRow.money[field].reportedValue,
        ]),
      ) as Record<BalanceMonetaryField, number | null>)
    : null;
  const comparisons = reportedTotals
    ? BALANCE_MONETARY_FIELDS.map((field): BalanceComparison => {
        const reported = reportedTotals[field];
        const difference =
          reported === null ? null : reported - systemTotals[field];
        if (difference !== null && Math.abs(difference) > tolerance)
          warnings.push({
            sourceRowNumber: totalRow?.sourceRowNumber ?? 0,
            field,
            code: "REPORTED_TOTAL_MISMATCH",
            message:
              "El total informado difiere del total calculado por JivaTax.",
            rawValue: { reported, calculated: systemTotals[field], difference },
          });
        return {
          field,
          reported,
          calculated: systemTotals[field],
          difference,
          status:
            reported === null
              ? "not_reported"
              : Math.abs(difference ?? 0) <= tolerance
                ? "matched"
                : "mismatched",
        };
      })
    : [];
  const movementDifference = systemTotals.debits - systemTotals.credits;
  const equityLeft = systemTotals.assets + systemTotals.losses;
  const equityRight = systemTotals.liabilities + systemTotals.gains;
  if (Math.abs(movementDifference) > tolerance)
    warnings.push({
      sourceRowNumber: 0,
      field: "movements",
      code: "DEBIT_CREDIT_NOT_BALANCED",
      message: "Los débitos y créditos calculados no cuadran.",
      rawValue: {
        debitTotal: systemTotals.debits,
        creditTotal: systemTotals.credits,
      },
    });
  if (Math.abs(equityLeft - equityRight) > tolerance)
    errors.push({
      sourceRowNumber: 0,
      field: "equity",
      code: "BALANCE_EQUATION_NOT_BALANCED",
      message: "La ecuación patrimonial calculada no cuadra.",
      rawValue: {
        assets: systemTotals.assets,
        liabilities: systemTotals.liabilities,
        losses: systemTotals.losses,
        gains: systemTotals.gains,
        leftSide: equityLeft,
        rightSide: equityRight,
        difference: equityLeft - equityRight,
      },
    });

  return {
    rows,
    errors,
    warnings,
    systemTotals,
    reportedTotals,
    comparisons,
    reconciliation: {
      movements: {
        debitTotal: systemTotals.debits,
        creditTotal: systemTotals.credits,
        difference: movementDifference,
        isBalanced: Math.abs(movementDifference) <= tolerance,
      },
      equity: {
        leftSide: equityLeft,
        rightSide: equityRight,
        difference: equityLeft - equityRight,
        isBalanced: Math.abs(equityLeft - equityRight) <= tolerance,
      },
    },
  };
}

function compareAccountBalance(
  row: BalanceParsedRow,
  field: "debitBalance" | "creditBalance",
  calculated: number,
  tolerance: number,
  warnings: BalanceIssue[],
) {
  const reported = row.money[field].reportedValue;
  if (reported === null && calculated > tolerance)
    warnings.push({
      sourceRowNumber: row.sourceRowNumber,
      field,
      code:
        field === "debitBalance"
          ? "MISSING_REPORTED_DEBIT_BALANCE"
          : "MISSING_REPORTED_CREDIT_BALANCE",
      message: "El saldo calculado existe, pero la celda informada está vacía.",
      rawValue: { reported, calculated, difference: null },
    });
  else if (reported !== null && Math.abs(reported - calculated) > tolerance)
    warnings.push({
      sourceRowNumber: row.sourceRowNumber,
      field,
      code:
        field === "debitBalance"
          ? "DEBIT_BALANCE_MISMATCH"
          : "CREDIT_BALANCE_MISMATCH",
      message: "El saldo informado difiere del saldo calculado.",
      rawValue: { reported, calculated, difference: reported - calculated },
    });
}

function accountSignature(row: BalanceParsedRow): string {
  return JSON.stringify({
    accountName: row.accountName,
    money: BALANCE_MONETARY_FIELDS.map(
      (field) => row.money[field].reportedValue,
    ),
  });
}

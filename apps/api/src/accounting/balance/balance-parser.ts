import { normalizeHeader } from "../contracts/document-contracts";

export enum BalanceRowType {
  ACCOUNT = "account",
  SUBTOTAL = "subtotal",
  RESULT = "result",
  TOTAL = "total",
  NOTE = "note",
  EMPTY = "empty",
  UNKNOWN = "unknown",
  REPORTED_SUMMARY = "reported_summary",
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
  severity?: "error" | "warning";
  reportedValue?: string | null;
  calculatedValue?: string;
  difference?: string | null;
};

export type InterpretedMoney = {
  reportedValue: number | null;
  effectiveValue: number;
  wasBlank: boolean;
  reportedDecimal: string | null;
  effectiveDecimal: string;
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
  calculatedDebitBalance: string | null;
  calculatedCreditBalance: string | null;
};

export type BalanceTotals = Record<BalanceMonetaryField, string>;

export type BalanceComparison = {
  field: BalanceMonetaryField;
  reported: string | null;
  calculated: string;
  difference: string | null;
  status: "matched" | "mismatched" | "not_reported";
};

export type ReportedSummaryType =
  "subtotal" | "period_result" | "company_total" | "other";

export function reportedSummaryType(
  row: BalanceParsedRow,
): ReportedSummaryType {
  if (row.rowType === BalanceRowType.SUBTOTAL) return "subtotal";
  if (row.rowType === BalanceRowType.RESULT) return "period_result";
  if (row.rowType === BalanceRowType.TOTAL) return "company_total";
  return "other";
}

export function normalizeSummaryLabel(value: unknown): string {
  return normalizeHeader(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const BALANCE_TOLERANCE = "0.0100";
const SCALE = 10_000n;
const emptyTotals = (): BalanceTotals => ({
  debits: "0.0000",
  credits: "0.0000",
  debitBalance: "0.0000",
  creditBalance: "0.0000",
  assets: "0.0000",
  liabilities: "0.0000",
  losses: "0.0000",
  gains: "0.0000",
});

function decimalToScaled(value: string): bigint {
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction = ""] = unsigned.split(".");
  const scaled =
    BigInt(integer || "0") * SCALE + BigInt(fraction.padEnd(4, "0"));
  return negative ? -scaled : scaled;
}

function scaledToDecimal(value: bigint): string {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  return `${negative ? "-" : ""}${absolute / SCALE}.${String(absolute % SCALE).padStart(4, "0")}`;
}

function addDecimal(left: string, right: string): string {
  return scaledToDecimal(decimalToScaled(left) + decimalToScaled(right));
}

function subtractDecimal(left: string, right: string): string {
  return scaledToDecimal(decimalToScaled(left) - decimalToScaled(right));
}

function exceedsTolerance(value: string, tolerance: string): boolean {
  const scaled = decimalToScaled(value);
  const absolute = scaled < 0n ? -scaled : scaled;
  return absolute > decimalToScaled(tolerance);
}

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
  const comparableName = normalizeSummaryLabel(accountNameRaw).toUpperCase();
  const hasMoney = relevantCells.slice(2).some((value) => !isBlank(value));

  if (
    !codePresent &&
    /RESULTADO DEL EJERCICIO|UTILIDAD DEL EJERCICIO|PERDIDA DEL EJERCICIO|GANANCIA PERD(IDA)? (DEL )?(EJERCICIO|EJ FISCAL)|GANANCIA PERD EJ FISCAL/.test(
      comparableName,
    )
  )
    return BalanceRowType.RESULT;
  if (!codePresent && /(^|\s)(SUMA|SUBTOTAL)(\s|$)/.test(comparableName))
    return BalanceRowType.SUBTOTAL;
  if (
    !codePresent &&
    /(^|\s)TOTAL(ES)?( EMPRESA| GENERAL)?(\s|$)/.test(comparableName)
  )
    return BalanceRowType.TOTAL;
  if (!codePresent && namePresent && hasMoney)
    return BalanceRowType.REPORTED_SUMMARY;
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
    return {
      reportedValue: null,
      effectiveValue: 0,
      reportedDecimal: null,
      effectiveDecimal: "0.0000",
      wasBlank: true,
    };

  const rawText = String(rawValue).trim();
  const normalized = /^-?\d{1,3}(\.\d{3})+$/.test(rawText)
    ? rawText.replaceAll(".", "")
    : rawText.replace(",", ".");
  if (!/^-?\d+(\.\d{1,4})?$/.test(normalized))
    return {
      reportedValue: null,
      effectiveValue: 0,
      reportedDecimal: null,
      effectiveDecimal: "0.0000",
      wasBlank: false,
      error: {
        sourceRowNumber,
        field,
        code: "INVALID_NUMBER",
        message: "El valor monetario no se puede interpretar.",
        rawValue,
      },
    };
  const decimal = scaledToDecimal(decimalToScaled(normalized));
  const value = Number(decimal);
  return {
    reportedValue: value,
    effectiveValue: value,
    reportedDecimal: decimal,
    effectiveDecimal: decimal,
    wasBlank: false,
    warning:
      decimalToScaled(decimal) < 0n
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
  tolerance = BALANCE_TOLERANCE,
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

    for (const [left, right, code] of [
      ["debitBalance", "creditBalance", "BOTH_DEBIT_AND_CREDIT_BALANCE"],
      ["assets", "liabilities", "BOTH_ASSET_AND_LIABILITY"],
      ["losses", "gains", "BOTH_LOSS_AND_GAIN"],
    ] as const)
      if (
        decimalToScaled(money[left].effectiveDecimal) > 0n &&
        decimalToScaled(money[right].effectiveDecimal) > 0n
      )
        errors.push({
          sourceRowNumber,
          field: `${left},${right}`,
          code,
          message: "La fila informa importes positivos incompatibles entre sí.",
          rawValue: {
            [left]: money[left].reportedDecimal,
            [right]: money[right].reportedDecimal,
          },
        });

    const movementBalance = subtractDecimal(
      money.debits.effectiveDecimal,
      money.credits.effectiveDecimal,
    );
    row.calculatedDebitBalance =
      decimalToScaled(movementBalance) > 0n ? movementBalance : "0.0000";
    row.calculatedCreditBalance =
      decimalToScaled(movementBalance) < 0n
        ? scaledToDecimal(-decimalToScaled(movementBalance))
        : "0.0000";
    compareAccountBalance(
      row,
      "debitBalance",
      row.calculatedDebitBalance,
      tolerance,
      warnings,
    );

    const hasBalance =
      exceedsTolerance(money.debitBalance.effectiveDecimal, tolerance) ||
      exceedsTolerance(money.creditBalance.effectiveDecimal, tolerance);
    const classifiedAmount = BALANCE_MONETARY_FIELDS.slice(4).reduce(
      (total, field) => addDecimal(total, money[field].effectiveDecimal),
      "0.0000",
    );
    if (hasBalance && !exceedsTolerance(classifiedAmount, tolerance)) {
      const unclassifiedDifference =
        money.debitBalance.reportedDecimal ??
        money.creditBalance.reportedDecimal;
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
  const summaryRows = rows.filter((row) =>
    [
      BalanceRowType.SUBTOTAL,
      BalanceRowType.RESULT,
      BalanceRowType.TOTAL,
      BalanceRowType.REPORTED_SUMMARY,
    ].includes(row.rowType),
  );
  const reportedSummaries = summaryRows.map((row) => ({
    type: reportedSummaryType(row),
    label: row.accountName ?? "",
    normalizedLabel: normalizeSummaryLabel(row.accountName),
    sourceRowNumber: row.sourceRowNumber,
    values: Object.fromEntries(
      BALANCE_MONETARY_FIELDS.map((field) => [
        field,
        row.money[field].reportedDecimal,
      ]),
    ),
  }));
  const systemTotals = emptyTotals();
  for (const row of accountRows)
    for (const field of BALANCE_MONETARY_FIELDS)
      systemTotals[field] = addDecimal(
        systemTotals[field],
        row.money[field].effectiveDecimal,
      );
  const totalRow = [...rows]
    .reverse()
    .find((row) => row.rowType === BalanceRowType.TOTAL);
  const reportedTotals = totalRow
    ? (Object.fromEntries(
        BALANCE_MONETARY_FIELDS.map((field) => [
          field,
          totalRow.money[field].reportedDecimal,
        ]),
      ) as Record<BalanceMonetaryField, string | null>)
    : null;
  const comparisons = reportedTotals
    ? BALANCE_MONETARY_FIELDS.map((field): BalanceComparison => {
        const reported = reportedTotals[field];
        const difference =
          reported === null
            ? null
            : subtractDecimal(reported, systemTotals[field]);
        if (difference !== null && exceedsTolerance(difference, tolerance))
          warnings.push({
            sourceRowNumber: totalRow?.sourceRowNumber ?? 0,
            field,
            code: "REPORTED_TOTAL_MISMATCH",
            severity: "warning",
            reportedValue: reported,
            calculatedValue: systemTotals[field],
            difference,
            message: `El total de ${field} informado por la empresa no coincide con la suma calculada desde las cuentas.`,
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
              : !exceedsTolerance(difference ?? "0.0000", tolerance)
                ? "matched"
                : "mismatched",
        };
      })
    : [];
  const subtotal = summaryRows.find(
    (row) => reportedSummaryType(row) === "subtotal",
  );
  const periodResult = summaryRows.find(
    (row) => reportedSummaryType(row) === "period_result",
  );
  const companyTotal = summaryRows.find(
    (row) => reportedSummaryType(row) === "company_total",
  );
  let reportedRollupMatches: boolean | null = null;
  if (subtotal && periodResult && companyTotal) {
    reportedRollupMatches = true;
    for (const field of BALANCE_MONETARY_FIELDS) {
      const subtotalValue = subtotal.money[field].reportedDecimal;
      const resultValue = periodResult.money[field].reportedDecimal;
      const totalValue = companyTotal.money[field].reportedDecimal;
      if (subtotalValue === null || resultValue === null || totalValue === null)
        continue;
      const difference = subtractDecimal(
        addDecimal(subtotalValue, resultValue),
        totalValue,
      );
      if (exceedsTolerance(difference, tolerance)) {
        reportedRollupMatches = false;
        warnings.push({
          sourceRowNumber: companyTotal.sourceRowNumber,
          field,
          code: "REPORTED_SUMMARY_ROLLUP_MISMATCH",
          message:
            "El subtotal más el resultado informado no coincide con el total empresa.",
          rawValue: {
            subtotal: subtotalValue,
            periodResult: resultValue,
            companyTotal: totalValue,
            difference,
          },
        });
      }
    }
  }
  const movementDifference = subtractDecimal(
    systemTotals.debits,
    systemTotals.credits,
  );
  const equityLeft = addDecimal(systemTotals.assets, systemTotals.losses);
  const equityRight = addDecimal(systemTotals.liabilities, systemTotals.gains);
  const equityDifference = subtractDecimal(equityLeft, equityRight);
  if (exceedsTolerance(movementDifference, tolerance))
    errors.push({
      sourceRowNumber: 0,
      field: "movements",
      code: "BALANCE_DEBIT_CREDIT_MISMATCH",
      message: "Los débitos y créditos calculados no cuadran.",
      rawValue: {
        debitTotal: systemTotals.debits,
        creditTotal: systemTotals.credits,
      },
    });
  if (exceedsTolerance(equityDifference, tolerance))
    errors.push({
      sourceRowNumber: 0,
      field: "equity",
      code: "BALANCE_EQUITY_EQUATION_MISMATCH",
      message: "La ecuación patrimonial calculada no cuadra.",
      rawValue: {
        assets: systemTotals.assets,
        liabilities: systemTotals.liabilities,
        losses: systemTotals.losses,
        gains: systemTotals.gains,
        leftSide: equityLeft,
        rightSide: equityRight,
        difference: equityDifference,
      },
    });

  return {
    rows,
    errors,
    warnings,
    systemTotals,
    reportedTotals,
    comparisons,
    reportedSummaries,
    calculatedTotals: systemTotals,
    totalDifferences: Object.fromEntries(
      comparisons.map((comparison) => [
        comparison.field,
        comparison.difference,
      ]),
    ),
    accountingChecks: {
      debitCreditBalanced: !exceedsTolerance(movementDifference, tolerance),
      equityEquationBalanced: !exceedsTolerance(equityDifference, tolerance),
      reportedTotalMatchesCalculated: comparisons.every(
        (comparison) => comparison.status !== "mismatched",
      ),
      reportedRollupMatches,
    },
    reconciliation: {
      movements: {
        debitTotal: systemTotals.debits,
        creditTotal: systemTotals.credits,
        difference: movementDifference,
        isBalanced: !exceedsTolerance(movementDifference, tolerance),
      },
      equity: {
        leftSide: equityLeft,
        rightSide: equityRight,
        difference: equityDifference,
        isBalanced: !exceedsTolerance(equityDifference, tolerance),
      },
    },
  };
}

function compareAccountBalance(
  row: BalanceParsedRow,
  field: "debitBalance" | "creditBalance",
  calculated: string,
  tolerance: string,
  warnings: BalanceIssue[],
) {
  const reported = row.money[field].reportedDecimal;
  if (reported === null && exceedsTolerance(calculated, tolerance))
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
  else if (
    reported !== null &&
    exceedsTolerance(subtractDecimal(reported, calculated), tolerance)
  )
    warnings.push({
      sourceRowNumber: row.sourceRowNumber,
      field,
      code:
        field === "debitBalance"
          ? "DEBIT_BALANCE_MISMATCH"
          : "CREDIT_BALANCE_MISMATCH",
      message: "El saldo informado difiere del saldo calculado.",
      rawValue: {
        reported,
        calculated,
        difference: subtractDecimal(reported, calculated),
      },
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

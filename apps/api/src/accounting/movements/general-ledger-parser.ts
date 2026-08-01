import {
  MovementParseResult,
  MovementParserContext,
} from "./movement-parser.types";
import {
  issue,
  normalizeText,
  validateAmount,
  validateDate,
} from "./movement-parser.utils";

export function parseGeneralLedger(
  context: MovementParserContext,
): MovementParseResult {
  const rows: Record<string, unknown>[] = [];
  const errors = [] as MovementParseResult["errors"];
  const warnings = [] as MovementParseResult["warnings"];
  let ignoredRows = 0;
  for (
    let index = context.headerRow + 1;
    index < context.matrix.length;
    index += 1
  ) {
    const source = context.matrix[index];
    if (
      source.every((value) => value === null || normalizeText(value) === "")
    ) {
      ignoredRows += 1;
      continue;
    }
    const sourceRowNumber = index + 1;
    const raw = Object.fromEntries(
      Object.entries(context.columns).map(([field, column]) => [
        field,
        source[column],
      ]),
    );
    for (const field of [
      "accountCode",
      "accountName",
      "date",
      "documentType",
      "documentNumber",
      "description",
      "debit",
      "credit",
    ])
      if (normalizeText(raw[field]) === "")
        errors.push(
          issue(
            sourceRowNumber,
            field,
            "REQUIRED_FIELD",
            "Campo obligatorio vacío.",
            raw[field],
          ),
        );
    const debit = validateAmount(raw.debit, "debit", sourceRowNumber, errors);
    const credit = validateAmount(
      raw.credit,
      "credit",
      sourceRowNumber,
      errors,
    );
    if (debit > 0 && credit > 0)
      errors.push(
        issue(
          sourceRowNumber,
          "debit",
          "BOTH_DEBIT_AND_CREDIT",
          "Debe y Haber no pueden ser positivos simultáneamente.",
          { debit: raw.debit, credit: raw.credit },
        ),
      );
    if (debit === 0 && credit === 0)
      warnings.push(
        issue(
          sourceRowNumber,
          "debit",
          "ZERO_MOVEMENT",
          "La fila no contiene movimiento en Debe ni Haber.",
          { debit: raw.debit, credit: raw.credit },
        ),
      );
    rows.push({
      ...raw,
      accountCode: normalizeText(raw.accountCode),
      accountName: normalizeText(raw.accountName),
      date: validateDate(raw.date, sourceRowNumber, context.period, errors),
      documentType: normalizeText(raw.documentType),
      documentNumber: normalizeText(raw.documentNumber),
      description: normalizeText(raw.description),
      debit,
      credit,
      sourceRowNumber,
      rawData: source,
      sheetName: context.sheetName,
    });
  }
  const totals = rows.reduce<{ debit: number; credit: number }>(
    (total, row) => ({
      debit: total.debit + Number(row.debit),
      credit: total.credit + Number(row.credit),
    }),
    { debit: 0, credit: 0 },
  );
  if (Math.abs(totals.debit - totals.credit) > 0.0001)
    warnings.push(
      issue(
        0,
        "totals",
        "UNBALANCED_LEDGER",
        "Los totales globales de Debe y Haber no cuadran.",
        totals,
      ),
    );
  return { rows, errors, warnings, ignoredRows, totals, details: {} };
}

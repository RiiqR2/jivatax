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

export function parseJournal(
  context: MovementParserContext,
): MovementParseResult {
  const rows: Record<string, unknown>[] = [];
  const errors = [] as MovementParseResult["errors"];
  const warnings = [] as MovementParseResult["warnings"];
  const sequences = new Set<string>();
  const duplicateSequences: Array<{ voucherNumber: string; sequence: number }> =
    [];
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
      "date",
      "voucherNumber",
      "sequence",
      "accountCode",
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
    const sequence = Number(raw.sequence);
    if (!Number.isInteger(sequence) || sequence < 0)
      errors.push(
        issue(
          sourceRowNumber,
          "sequence",
          "INVALID_SEQUENCE",
          "La secuencia debe ser un entero no negativo.",
          raw.sequence,
        ),
      );
    const voucherNumber = normalizeText(raw.voucherNumber);
    const sequenceKey = `${voucherNumber}\u0000${sequence}`;
    if (Number.isInteger(sequence) && sequences.has(sequenceKey)) {
      duplicateSequences.push({ voucherNumber, sequence });
      errors.push(
        issue(
          sourceRowNumber,
          "sequence",
          "DUPLICATE_VOUCHER_SEQUENCE",
          "La secuencia ya existe dentro del comprobante.",
          raw.sequence,
        ),
      );
    }
    sequences.add(sequenceKey);
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
      date: validateDate(raw.date, sourceRowNumber, context.period, errors),
      voucherNumber,
      sequence,
      accountCode: normalizeText(raw.accountCode),
      description: normalizeText(raw.description),
      debit,
      credit,
      sourceRowNumber,
      rawData: source,
      sheetName: context.sheetName,
    });
  }
  const vouchers = new Map<string, { debit: number; credit: number }>();
  for (const row of rows) {
    const voucher = String(row.voucherNumber);
    const total = vouchers.get(voucher) ?? { debit: 0, credit: 0 };
    total.debit += Number(row.debit);
    total.credit += Number(row.credit);
    vouchers.set(voucher, total);
  }
  let balancedVoucherCount = 0;
  for (const [voucherNumber, totals] of vouchers) {
    if (Math.abs(totals.debit - totals.credit) <= 0.0001)
      balancedVoucherCount += 1;
    else
      errors.push(
        issue(
          rows.find((row) => row.voucherNumber === voucherNumber)
            ?.sourceRowNumber as number,
          "voucherNumber",
          "UNBALANCED_VOUCHER",
          "El comprobante no cuadra entre Debe y Haber.",
          { voucherNumber, ...totals },
        ),
      );
  }
  const totals = rows.reduce<{ debit: number; credit: number }>(
    (total, row) => ({
      debit: total.debit + Number(row.debit),
      credit: total.credit + Number(row.credit),
    }),
    { debit: 0, credit: 0 },
  );
  return {
    rows,
    errors,
    warnings,
    ignoredRows,
    totals,
    details: {
      voucherCount: vouchers.size,
      balancedVoucherCount,
      unbalancedVoucherCount: vouchers.size - balancedVoucherCount,
      duplicateSequences,
      voucherBalances: Object.fromEntries(vouchers),
    },
  };
}

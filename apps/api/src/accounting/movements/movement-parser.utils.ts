import * as XLSX from "xlsx";
import { MovementIssue, MovementPeriod } from "./movement-parser.types";

export function issue(
  row: number,
  field: string,
  code: string,
  message: string,
  rawValue: unknown,
): MovementIssue {
  return { sourceRowNumber: row, field, code, message, rawValue };
}

export function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeDate(value: unknown): string | null {
  let date: Date | null = null;
  let expectedParts: [number, number, number] | null = null;
  if (value instanceof Date && Number.isFinite(value.getTime())) date = value;
  else if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  } else if (typeof value === "string") {
    const text = value.trim();
    const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      expectedParts = [Number(match[3]), Number(match[2]), Number(match[1])];
      date = new Date(
        Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])),
      );
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      expectedParts = text.split("-").map(Number) as [number, number, number];
      date = new Date(`${text}T00:00:00Z`);
    }
  }
  if (!date || !Number.isFinite(date.getTime())) return null;
  if (
    expectedParts &&
    (date.getUTCFullYear() !== expectedParts[0] ||
      date.getUTCMonth() + 1 !== expectedParts[1] ||
      date.getUTCDate() !== expectedParts[2])
  )
    return null;
  const result = date.toISOString().slice(0, 10);
  const [year, month, day] = result.split("-").map(Number);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  )
    return null;
  return result;
}

export function validateDate(
  value: unknown,
  row: number,
  period: MovementPeriod,
  errors: MovementIssue[],
): string | null {
  const date = normalizeDate(value);
  if (!date) {
    errors.push(
      issue(row, "date", "INVALID_DATE", "La fecha no es válida.", value),
    );
    return null;
  }
  if (
    date < period.startDate ||
    date > period.endDate ||
    Number(date.slice(0, 4)) !== period.commercialYear
  )
    errors.push(
      issue(
        row,
        "date",
        "DATE_OUTSIDE_COMMERCIAL_PERIOD",
        "La fecha está fuera del período comercial.",
        value,
      ),
    );
  return date;
}

export function validateAmount(
  value: unknown,
  field: "debit" | "credit",
  row: number,
  errors: MovementIssue[],
): number {
  const amount = value === null || value === "" ? 0 : Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    errors.push(
      issue(
        row,
        field,
        "INVALID_NUMBER",
        "Debe ser un monto no negativo.",
        value,
      ),
    );
    return 0;
  }
  return amount;
}

import type {
  NormalizedSiiAccountRow,
  ValidatedSiiAccountRow,
} from "../interfaces/normalized-sii-account-row.interface";

export interface ValidationResult {
  rows: ValidatedSiiAccountRow[];
  ignoredRows: number;
  errors: string[];
  warnings: string[];
  duplicateCodes: string[];
}

export function validateRows(
  rows: NormalizedSiiAccountRow[],
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const candidateRows: NormalizedSiiAccountRow[] = [];
  let ignoredRows = 0;

  for (const row of rows) {
    if (!row.code && row.name) {
      ignoredRows += 1;
      warnings.push(
        `Fila ${row.sourceRowNumber}: título o nota sin código ignorado.`,
      );
      continue;
    }
    if (!row.code && !row.name) {
      ignoredRows += 1;
      continue;
    }
    if (!row.code) {
      ignoredRows += 1;
      continue;
    }
    if (!row.name) {
      errors.push(`Fila ${row.sourceRowNumber}: nombre ausente.`);
      continue;
    }
    if (row.code.length > 100) {
      errors.push(`Fila ${row.sourceRowNumber}: código excede 100 caracteres.`);
      continue;
    }
    if (row.name.length > 500) {
      errors.push(`Fila ${row.sourceRowNumber}: nombre excede 500 caracteres.`);
      continue;
    }
    candidateRows.push(row);
  }

  const counts = new Map<string, number>();
  for (const row of candidateRows) {
    counts.set(row.code!, (counts.get(row.code!) ?? 0) + 1);
  }
  const duplicateCodes = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([code]) => code)
    .sort();
  if (duplicateCodes.length > 0) {
    errors.push(`Códigos duplicados: ${duplicateCodes.join(", ")}.`);
  }

  return {
    rows: candidateRows.map((row, index) => ({
      ...row,
      code: row.code!,
      name: row.name!,
      sortOrder: index + 1,
      parentCode: null,
    })),
    ignoredRows,
    errors,
    warnings,
    duplicateCodes,
  };
}

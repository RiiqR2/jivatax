import type { ValidatedSiiAccountRow } from "../interfaces/normalized-sii-account-row.interface";

export interface HierarchyResult {
  rows: ValidatedSiiAccountRow[];
  missingParents: string[];
  warnings: string[];
}

function levelAndCandidates(code: string): {
  level: number;
  candidates: string[];
} {
  const parts = code.split(".");
  let last = parts.length - 1;
  while (last > 0 && parts[last] === "00") last -= 1;
  const level = last + 1;
  const candidates: string[] = [];
  for (let position = last; position > 0; position -= 1) {
    candidates.push(
      parts.map((part, index) => (index >= position ? "00" : part)).join("."),
    );
  }
  return { level, candidates };
}

export function resolveHierarchy(
  rows: ValidatedSiiAccountRow[],
): HierarchyResult {
  const codes = new Set(rows.map((row) => row.code));
  const missingParents: string[] = [];
  const resolved = rows.map((row) => {
    const derived = levelAndCandidates(row.code);
    const parentCode =
      derived.candidates.find((candidate) => codes.has(candidate)) ?? null;
    if (derived.level > 1 && !parentCode) missingParents.push(row.code);
    return { ...row, level: derived.level, parentCode };
  });
  return {
    rows: resolved,
    missingParents,
    warnings: missingParents.map(
      (code) => `Cuenta ${code}: no se encontró un ancestro existente.`,
    ),
  };
}

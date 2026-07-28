import type { ValidatedSiiAccountRow } from "../interfaces/normalized-sii-account-row.interface";

export interface HierarchyResult {
  rows: ValidatedSiiAccountRow[];
  missingParents: string[];
  warnings: string[];
}

export function resolveHierarchy(
  rows: ValidatedSiiAccountRow[],
): HierarchyResult {
  if (!rows.some((row) => row.level !== null)) {
    return {
      rows,
      missingParents: [],
      warnings: [
        "El archivo no provee una señal explícita de jerarquía; level y parentId quedan nulos.",
      ],
    };
  }

  const stack = new Map<number, string>();
  const missingParents: string[] = [];
  const resolved = rows.map((row) => {
    if (row.level === null) {
      return row;
    }
    const parentCode =
      row.level > 1 ? (stack.get(row.level - 1) ?? null) : null;
    if (row.level > 1 && !parentCode) {
      missingParents.push(row.code);
    }
    stack.set(row.level, row.code);
    for (const level of [...stack.keys()]) {
      if (level > row.level) {
        stack.delete(level);
      }
    }
    return {
      ...row,
      parentCode,
    };
  });

  return {
    rows: resolved,
    missingParents,
    warnings:
      missingParents.length > 0
        ? [
            `${missingParents.length} cuentas no tienen padre explícito disponible.`,
          ]
        : [],
  };
}

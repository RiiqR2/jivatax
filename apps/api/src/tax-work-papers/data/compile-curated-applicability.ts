import type { CuratedApplicabilitySourceRow } from "./curated-applicability-matrix";

export const APPLICABILITY_ONLY_ROLE = "APPLICABILITY_ONLY";

export interface CompiledApplicability {
  workPaperCode: string;
  siiAccountCode: string;
  roleKey: string;
  sourceRows: number[];
}

export interface IgnoredApplicabilityRow {
  sourceRow: number;
  reason:
    | "paper_zero"
    | "paper_out_of_scope"
    | "invalid_paper_code"
    | "empty_sii_code";
}

export interface CuratedApplicabilityReport {
  sourceRowsA1ToA20: number;
  validAssociations: CompiledApplicability[];
  missingCatalogCodes: Array<{ siiAccountCode: string; sourceRows: number[] }>;
  duplicateRows: Array<{ key: string; sourceRows: number[] }>;
  ignoredRows: IgnoredApplicabilityRow[];
  papersWithoutAssociations: string[];
  codesWithMultiplePapers: Array<{
    siiAccountCode: string;
    workPaperCodes: string[];
  }>;
}

const PAPER_CODE = /^A\.(\d+)$/i;

/** Only trims transport whitespace; punctuation and leading zeroes are identity. */
export function normalizeSiiAccountCode(value: string): string {
  return value.trim();
}

/**
 * Compiles and audits a transcription against codes from the ACTIVE catalog.
 * It intentionally does not receive catalog names, UUIDs, or hierarchy.
 */
export function compileCuratedApplicability(
  rows: readonly CuratedApplicabilitySourceRow[],
  activeCatalogCodes: ReadonlySet<string>,
): CuratedApplicabilityReport {
  const ignoredRows: IgnoredApplicabilityRow[] = [];
  const inScope: Array<
    CuratedApplicabilitySourceRow & { normalizedCode: string }
  > = [];

  for (const row of rows) {
    const paper = row.workPaperCode.trim().toUpperCase();
    if (paper === "0") {
      ignoredRows.push({ sourceRow: row.sourceRow, reason: "paper_zero" });
      continue;
    }
    const match = PAPER_CODE.exec(paper);
    if (!match) {
      ignoredRows.push({
        sourceRow: row.sourceRow,
        reason: "invalid_paper_code",
      });
      continue;
    }
    const number = Number(match[1]);
    if (number < 1 || number > 20) {
      ignoredRows.push({
        sourceRow: row.sourceRow,
        reason: "paper_out_of_scope",
      });
      continue;
    }
    const normalizedCode = normalizeSiiAccountCode(row.siiAccountCode);
    if (!normalizedCode) {
      ignoredRows.push({ sourceRow: row.sourceRow, reason: "empty_sii_code" });
      continue;
    }
    inScope.push({
      ...row,
      workPaperCode: `A.${number}`,
      normalizedCode,
    });
  }

  const grouped = new Map<string, CompiledApplicability>();
  for (const row of inScope) {
    const roleKey = row.roleKey?.trim() || APPLICABILITY_ONLY_ROLE;
    const key = `${row.workPaperCode}\u0000${row.normalizedCode}\u0000${roleKey}`;
    const existing = grouped.get(key);
    if (existing) existing.sourceRows.push(row.sourceRow);
    else
      grouped.set(key, {
        workPaperCode: row.workPaperCode,
        siiAccountCode: row.normalizedCode,
        roleKey,
        sourceRows: [row.sourceRow],
      });
  }

  const associations = [...grouped.entries()];
  const duplicateRows = associations
    .filter(([, value]) => value.sourceRows.length > 1)
    .map(([key, value]) => ({ key, sourceRows: value.sourceRows }));
  const missing = associations.filter(
    ([, value]) => !activeCatalogCodes.has(value.siiAccountCode),
  );
  const validAssociations = associations
    .filter(([, value]) => activeCatalogCodes.has(value.siiAccountCode))
    .map(([, value]) => value);

  const associatedPapers = new Set(
    validAssociations.map((row) => row.workPaperCode),
  );
  const byCode = new Map<string, Set<string>>();
  for (const row of validAssociations) {
    const papers = byCode.get(row.siiAccountCode) ?? new Set<string>();
    papers.add(row.workPaperCode);
    byCode.set(row.siiAccountCode, papers);
  }

  return {
    sourceRowsA1ToA20: inScope.length,
    validAssociations,
    missingCatalogCodes: missing.map(([, value]) => ({
      siiAccountCode: value.siiAccountCode,
      sourceRows: value.sourceRows,
    })),
    duplicateRows,
    ignoredRows,
    papersWithoutAssociations: Array.from(
      { length: 20 },
      (_, index) => `A.${index + 1}`,
    ).filter((paper) => !associatedPapers.has(paper)),
    codesWithMultiplePapers: [...byCode.entries()]
      .filter(([, papers]) => papers.size > 1)
      .map(([siiAccountCode, papers]) => ({
        siiAccountCode,
        workPaperCodes: [...papers].sort(
          (a, b) => Number(a.slice(2)) - Number(b.slice(2)),
        ),
      })),
  };
}

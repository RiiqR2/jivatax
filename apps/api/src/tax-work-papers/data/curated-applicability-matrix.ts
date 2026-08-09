/**
 * Versioned transcription of the Tax team's curated applicability source.
 *
 * IMPORTANT: this is deliberately empty because the external matrix was not
 * present in the repository or execution environment for this delivery. Rows
 * must only be transcribed from that source; account names and hierarchy are
 * never acceptable substitutes.
 */
export interface CuratedApplicabilitySourceRow {
  sourceRow: number;
  workPaperCode: string;
  siiAccountCode: string;
  accountType?: string;
  roleKey?: string;
}

export const CURATED_APPLICABILITY_MATRIX_VERSION =
  "tax-team-matrix-awaiting-source";

export const CURATED_APPLICABILITY_SOURCE_ROWS: readonly CuratedApplicabilitySourceRow[] =
  [];

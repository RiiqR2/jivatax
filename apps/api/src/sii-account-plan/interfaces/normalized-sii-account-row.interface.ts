export interface NormalizedSiiAccountRow {
  sourceRowNumber: number;
  code: string | null;
  name: string | null;
  description: string | null;
  level: number | null;
  sourceColumns: Record<string, string | number | boolean | null>;
}

export interface ValidatedSiiAccountRow extends NormalizedSiiAccountRow {
  code: string;
  name: string;
  sortOrder: number;
  parentCode: string | null;
}

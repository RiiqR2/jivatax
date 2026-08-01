export type TaxPeriod = {
  id: string;
  companyId: string;
  commercialYear: number;
  taxYear: number;
  status: "open" | "processing" | "reviewed" | "closed";
  startDate: string;
  endDate: string;
  isActive: boolean;
};

export type TaxDocumentType = "balance" | "general_ledger" | "journal";

export type TaxDocument = {
  id: string;
  documentType: TaxDocumentType;
  status: string;
  versionNumber: number;
  uploadedAt: string;
  uploadedByUserId: string;
  uploadedBy: { id: string; name: string; email: string } | null;
  replacesDocumentId?: string | null;
  replacedByDocumentId?: string | null;
  errorSummary?: string | null;
  warningSummary?: string | null;
  storedFile: { id: string; originalName: string; sizeBytes: string };
  metadata: TaxDocumentReport | null;
  discardedAt?: string | null;
  discardReason?: string | null;
};

export type TaxDocumentReport = {
  rowsRead?: number;
  validRows?: number;
  ignoredRows?: number;
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
  totals?: Record<string, unknown>;
  reconciliation?: {
    movements?: {
      debitTotal: number;
      creditTotal: number;
      difference: number;
      isBalanced: boolean;
    };
    equity?: {
      leftSide: number;
      rightSide: number;
      difference: number;
      isBalanced: boolean;
    };
  };
  detectedSheet?: string;
  headerRowNumber?: number;
  sourceRowsRead?: number;
  accountRows?: number;
  summaryRows?: number;
  emptyRows?: number;
  unknownRows?: number;
  validAccountRows?: number;
  invalidAccountRows?: number;
  reportedTotals?: Record<string, number | null> | null;
  systemTotals?: Record<string, number>;
  comparisons?: BalanceComparison[];
};

export type BalanceComparison = {
  field: string;
  reported: number | null;
  calculated: number;
  difference: number | null;
  status: "matched" | "mismatched" | "not_reported";
};

export type ValidationIssue = {
  sourceRowNumber: number;
  field: string;
  code: string;
  message: string;
  rawValue: unknown;
};

export type AccountMappingItem = {
  companyAccountId: string;
  code: string;
  canonicalName: string;
  periodName: string;
  lastSeenTaxYear: number | null;
  lastSeenAt: string | null;
  usedInPeriod: boolean;
  isNewInPeriod: boolean;
  nameChanged: boolean;
  mapping: {
    id: string;
    status: "pending" | "suggested" | "confirmed" | "rejected" | "unmapped";
    matchMethod: string | null;
    confidence: number | null;
    siiAccount: { id: string; code: string; name: string } | null;
  };
  suggestions: Array<{
    id: string;
    siiAccount: { id: string; code: string; name: string };
    score: number;
    confidence: number;
    algorithmVersion: string;
    status: "active" | "review";
    reasons: Array<{ signal: string; description: string; points: number }>;
  }>;
};

export type AccountMappingsResponse = {
  context: {
    company: { id: string; legalName: string; taxId: string | null };
    taxPeriod: {
      id: string;
      commercialYear: number;
      taxYear: number;
      status: string;
    };
    sourceDocument: {
      id: string;
      filename: string;
      version: number;
      processedAt: string | null;
    } | null;
  };
  items: AccountMappingItem[];
  total: number;
  page: number;
  limit: number;
  summary: {
    total: number;
    pending: number;
    suggested: number;
    confirmed: number;
    rejected: number;
    newInPeriod: number;
    nameChanged: number;
    withoutSuggestion: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
};

export type ApproveSuggestionsBatchResponse = {
  requested: number;
  approved: number;
  skipped: number;
  results: Array<{
    companyAccountId: string;
    status: "approved" | "skipped";
    reason?: string;
    siiAccountId?: string;
  }>;
};

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
export type BalanceRole = "opening" | "closing";

export type TaxDocument = {
  id: string;
  documentType: TaxDocumentType;
  balanceRole: BalanceRole | null;
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
      debitTotal: number | string;
      creditTotal: number | string;
      difference: number | string;
      isBalanced: boolean;
    };
    equity?: {
      leftSide: number | string;
      rightSide: number | string;
      difference: number | string;
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
  reportedTotals?: Record<string, string | null> | null;
  systemTotals?: Record<string, string>;
  calculatedTotals?: Record<string, string>;
  totalDifferences?: Record<string, string | null>;
  reportedSummaries?: Array<{
    type: "subtotal" | "period_result" | "company_total" | "other";
    label: string;
    normalizedLabel: string;
    sourceRowNumber: number;
    values: Record<string, string | null>;
  }>;
  accountingChecks?: {
    debitCreditBalanced: boolean;
    equityEquationBalanced: boolean;
    reportedTotalMatchesCalculated: boolean;
    reportedRollupMatches: boolean | null;
  };
  comparisons?: BalanceComparison[];
};

export type BalanceComparison = {
  field: string;
  reported: string | null;
  calculated: string;
  difference: string | null;
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

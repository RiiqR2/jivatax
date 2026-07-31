export interface AdminSiiAccountPlanVersion {
  id: string;
  code: string;
  name: string;
  accountCount: number;
  createdAt: string;
}

export interface AdminSiiAccount {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

export interface AdminSiiAccountsResponse {
  items: AdminSiiAccount[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminAccountMatchingCoverageAccount {
  code: string;
  name: string;
  hasAliases: boolean;
  hasConcepts: boolean;
  usedInLearning: boolean;
}

export interface AdminAccountMatchingCoverage {
  versionId: string;
  total: number;
  withAliases: number;
  withoutAliases: number;
  withConcepts: number;
  withoutConcepts: number;
  usedInLearning: number;
  neverUsedInLearning: number;
  ambiguous: number;
  manuallyReviewed: number;
  correctedAfterReview: number;
  accounts: AdminAccountMatchingCoverageAccount[];
}

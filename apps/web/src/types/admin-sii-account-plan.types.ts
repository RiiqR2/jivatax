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

export interface AdminAccountMatchingCoverage {
  global: {
    learningCount: number;
    averageConfidence: number;
    activeConfirmationCount: number;
    expertConfirmationCount: number;
    contributingCompanyCount: number;
    industryCount: number;
    lastEvidenceAt: string | null;
    recentConfirmationCount: number;
    previousPeriodConfirmationCount: number;
  };
  quality: {
    confidence: AdminLearningDistribution;
    agreement: AdminLearningDistribution;
  };
  diversity: {
    singleCompanyLearningCount: number;
    multipleCompanyLearningCount: number;
    expertOnlyLearningCount: number;
    mixedEvidenceLearningCount: number;
    invalidatedConfirmationCount: number;
  };
  conflicts: Array<{
    normalizedName: string;
    destinationCount: number;
    confirmationCount: number;
    maximumConfidence: number;
    minimumAgreementRate: number;
    candidates: Array<{
      siiAccountId: string;
      siiAccountCode: string | null;
      siiAccountName: string | null;
      confirmationCount: number;
      distinctCompanyCount: number;
      agreementRate: number;
      confidence: number;
    }>;
  }>;
  industries: Array<{
    industryId: string;
    industryName: string;
    companyCount: number;
    learnedNameCount: number;
    confirmationCount: number;
    averageConfidence: number;
  }>;
  feedback: {
    total: number;
    accepted: number;
    corrected: number;
    acceptanceRate: number;
    correctionRate: number;
  };
  catalogue: {
    versionId: string;
    total: number;
    withAliases: number;
    withoutAliases: number;
    withConcepts: number;
    withoutConcepts: number;
    usedInLearning: number;
    neverUsedInLearning: number;
  };
}

export interface AdminLearningDistribution {
  high: number;
  medium: number;
  low: number;
}

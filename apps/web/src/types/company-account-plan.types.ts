export type CompanyAccountMappingStatus =
  "suggested" | "confirmed" | "rejected" | "unmapped";

export type CompanyAccountMappingMethod =
  "manual" | "exact_code" | "exact_name" | "normalized_name" | "contains_name";

export interface ImportCompanyAccountPlanInput {
  storedFileId: string;
  name: string;
}

export interface AssignCompanyAccountMappingInput {
  siiAccountId: string;
  notes?: string;
}

export interface ConfirmCompanyAccountMappingInput {
  notes?: string;
}

export interface RejectCompanyAccountMappingInput {
  notes?: string;
}

export interface CompanyAccountPlanVersion {
  id: string;
  name: string;
  sourceFileName: string;
  status: "draft" | "processing" | "ready" | "failed" | "archived";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedAt: string | null;
  createdAt: string;
  mappingCounts?: Partial<Record<CompanyAccountMappingStatus, number>>;
}

export interface CompanyAccountFilters {
  search?: string;
  mappingStatus?: CompanyAccountMappingStatus;
  mappingMethod?: CompanyAccountMappingMethod;
  minConfidence?: number;
  page?: number;
  pageSize?: number;
}

export interface CompanyAccount {
  id: string;
  internalCode: string;
  name: string;
  description: string | null;
  mapping: CompanyAccountMapping | null;
}

export interface CompanyAccountMapping {
  id: string;
  status: CompanyAccountMappingStatus;
  method: CompanyAccountMappingMethod;
  confidence: number | null;
  notes: string | null;
  siiAccount: SiiAccount | null;
}

export interface SiiAccount {
  id: string;
  code: string;
  name: string;
}

export enum CompanyAccountPlanVersionStatus {
  DRAFT = "draft",
  PROCESSING = "processing",
  READY = "ready",
  FAILED = "failed",
  ARCHIVED = "archived",
}

export enum CompanyAccountStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export enum CompanyAccountMappingStatus {
  SUGGESTED = "suggested",
  CONFIRMED = "confirmed",
  REJECTED = "rejected",
  UNMAPPED = "unmapped",
}

export enum CompanyAccountMappingMethod {
  MANUAL = "manual",
  EXACT_CODE = "exact_code",
  EXACT_NAME = "exact_name",
  NORMALIZED_NAME = "normalized_name",
  CONTAINS_NAME = "contains_name",
  AUTOMATIC = "automatic",
}

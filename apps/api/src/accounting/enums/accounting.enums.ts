export enum TaxPeriodStatus {
  OPEN = "open",
  PROCESSING = "processing",
  REVIEWED = "reviewed",
  CLOSED = "closed",
}

export enum TaxDocumentType {
  BALANCE = "balance",
  GENERAL_LEDGER = "general_ledger",
  JOURNAL = "journal",
}

export enum TaxDocumentStatus {
  UPLOADED = "uploaded",
  VALIDATING = "validating",
  VALID = "valid",
  INVALID = "invalid",
  PROCESSING = "processing",
  PROCESSED = "processed",
  SUPERSEDED = "superseded",
  PROCESSING_ERROR = "processing_error",
}

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

export enum BalanceRole {
  OPENING = "opening",
  CLOSING = "closing",
}

export enum TaxDocumentStatus {
  UPLOADED = "uploaded",
  VALIDATING = "validating",
  VALID = "valid",
  INVALID = "invalid",
  PROCESSING = "processing",
  PROCESSED = "processed",
  SUPERSEDED = "superseded",
  DISCARDED = "discarded",
  PROCESSING_ERROR = "processing_error",
}

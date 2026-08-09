export enum WorkPaperDefinitionStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  RETIRED = "retired",
}
export enum WorkPaperExecutionStatus {
  DRAFT = "draft",
  FINALIZED = "finalized",
}
export enum WorkPaperInputSourceType {
  BALANCE = "balance",
  GENERAL_LEDGER = "general_ledger",
  TAX_DOCUMENT = "tax_document",
  AUXILIARY = "auxiliary",
  MANUAL = "manual",
  ECONOMIC_SERIES = "economic_series",
  PRIOR_PERIOD = "prior_period",
  WORK_PAPER_EXECUTION = "work_paper_execution",
}
export enum WorkPaperRecordStatus {
  DRAFT = "draft",
  FINALIZED = "finalized",
  VOID = "void",
}
export enum TaxAdjustmentType {
  RLI_ADD = "RLI_ADD",
  RLI_DEDUCT = "RLI_DEDUCT",
  CPT_ASSET_ADD = "CPT_ASSET_ADD",
  CPT_ASSET_DEDUCT = "CPT_ASSET_DEDUCT",
  CPT_LIABILITY_ADD = "CPT_LIABILITY_ADD",
  CPT_LIABILITY_DEDUCT = "CPT_LIABILITY_DEDUCT",
  DEFERRED_TAX_ASSET = "DEFERRED_TAX_ASSET",
  DEFERRED_TAX_LIABILITY = "DEFERRED_TAX_LIABILITY",
}
export enum TaxDifferenceNature {
  TEMPORARY = "temporary",
  PERMANENT = "permanent",
  NOT_APPLICABLE = "not_applicable",
}

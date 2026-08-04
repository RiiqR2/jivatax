export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
export type BalanceAccount = {
  accountId: string;
  code: string;
  name: string;
  siiCode: string | null;
  siiName: string | null;
  mappingStatus:
    "pending" | "suggested" | "confirmed" | "rejected" | "unmapped";
  balanceDebit: string;
  balanceCredit: string;
  debitBalance: string;
  creditBalance: string;
  assetAmount: string;
  liabilityAmount: string;
  lossAmount: string;
  gainAmount: string;
  ledgerDebit: string | null;
  ledgerCredit: string | null;
  debitDifference: string | null;
  creditDifference: string | null;
  reconciliationStatus:
    "reconciled" | "difference" | "no_ledger" | "unavailable";
  ledgerMovementCount: number;
  lastLedgerMovementDate: string | null;
  hasLedgerMovements: boolean;
  canOpenLedger: boolean;
};
export type BalanceSummary = {
  totalAccounts: number;
  mappedAccounts: number;
  pendingMappingAccounts: number;
  reconciledAccounts: number;
  accountsWithDifferences: number;
  accountsWithoutLedgerMovements: number;
  reconciliationUnavailable: boolean;
  totalBalanceDebit: string;
  totalBalanceCredit: string;
  totalLedgerDebit: string | null;
  totalLedgerCredit: string | null;
  totalDebitDifference: string | null;
  totalCreditDifference: string | null;
};
export type BalanceResponse = Paginated<BalanceAccount> & {
  balanceAvailable: boolean;
  summary: BalanceSummary;
  sources: {
    companyName: string;
    commercialYear: number;
    taxYear: number;
    openingBalanceDocument: {
      id: string;
      versionNumber: number;
      processedAt: string;
    } | null;
    closingBalanceDocument: {
      id: string;
      versionNumber: number;
      processedAt: string;
    } | null;
    generalLedgerDocument: {
      id: string;
      versionNumber: number;
      processedAt: string;
    } | null;
  };
  openingControl: {
    openingBalanceAvailable: boolean;
    previousClosingAvailable: boolean;
    matchingAccounts: number;
    accountsWithDifferences: number;
    onlyInOpening: number;
    onlyInPreviousClosing: number;
    warning: string | null;
  };
};
export type LedgerEntry = {
  id: string;
  transactionDate: string;
  documentType: string | null;
  documentNumber: string | null;
  description: string;
  debit: string;
  credit: string;
  runningBalance: string;
};
export type LedgerResponse = Paginated<LedgerEntry> & {
  account: { id: string; code: string; name: string };
  generalLedgerAvailable: boolean;
};

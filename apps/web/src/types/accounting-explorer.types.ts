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
  balanceDebits: string;
  balanceCredits: string;
  balanceDebitBalance: string;
  balanceCreditBalance: string;
  balanceAssets: string;
  balanceLiabilities: string;
  balanceLosses: string;
  balanceGains: string;
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
  reconciledAccounts: number;
  accountsWithDifferences: number;
  accountsWithoutLedgerMovements: number;
  reconciliationUnavailable: boolean;
  totalBalanceDebits: string;
  totalBalanceCredits: string;
  totalBalanceDebitBalance: string;
  totalBalanceCreditBalance: string;
  totalBalanceAssets: string;
  totalBalanceLiabilities: string;
  totalBalanceLosses: string;
  totalBalanceGains: string;
  debitCreditDifference: string;
  debitCreditBalanced: boolean;
  debitCreditBalanceDifference: string;
  debitCreditBalanceBalanced: boolean;
  accountingEquationLeft: string;
  accountingEquationRight: string;
  accountingEquationDifference: string;
  accountingEquationBalanced: boolean;
  netResultAmount: string;
  netResultType: "profit" | "loss" | "zero";
  assetAccountCount: number;
  liabilityAccountCount: number;
  lossAccountCount: number;
  gainAccountCount: number;
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

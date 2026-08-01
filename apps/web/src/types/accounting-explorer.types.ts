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
  debit: string;
  credit: string;
  debitBalance: string;
  creditBalance: string;
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
};

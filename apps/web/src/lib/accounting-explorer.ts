export function balancePath(companyId: string, taxPeriodId: string) {
  return `/companies/${companyId}/periods/${taxPeriodId}/balance`;
}

export function ledgerPath(
  companyId: string,
  taxPeriodId: string,
  accountId: string,
  returnTo?: string,
) {
  const path = `${balancePath(companyId, taxPeriodId)}/accounts/${accountId}/general-ledger`;
  return returnTo ? `${path}?returnTo=${encodeURIComponent(returnTo)}` : path;
}

export function safeBalanceReturnTo(
  value: string | null,
  companyId: string,
  taxPeriodId: string,
) {
  const expected = balancePath(companyId, taxPeriodId);
  return value && (value === expected || value.startsWith(`${expected}?`))
    ? value
    : expected;
}

export function formatAccountingAmount(value: string | number | null) {
  if (value === null) return "—";
  const [rawInteger, rawDecimals = ""] = String(value).split(".");
  const sign = rawInteger.startsWith("-") ? "-" : "";
  const integer = rawInteger.replace(/^-/, "").replace(/^0+(?=\d)/, "");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimals = rawDecimals.slice(0, 2).replace(/0+$/, "");
  return `${sign}${grouped || "0"}${decimals ? `,${decimals}` : ""}`;
}

export function formatAccountingDate(value: string | null | undefined) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

export type BalanceExplorerFilters = {
  search: string;
  section: string;
  reconciliation: string;
  sort: string;
  direction: string;
  page: number;
  balanceDocumentId?: string;
};

export function buildBalanceExplorerParams(filters: BalanceExplorerFilters) {
  const params: Record<string, string | number> = {
    page: filters.page,
    pageSize: 25,
    sort: filters.sort,
    direction: filters.direction,
  };
  const search = filters.search.trim();
  if (search) params.search = search;
  if (filters.section) params.section = filters.section;
  if (filters.reconciliation !== "all")
    params.reconciliation = filters.reconciliation;
  if (filters.balanceDocumentId)
    params.balanceDocumentId = filters.balanceDocumentId;
  return params;
}

export type LedgerExplorerFilters = {
  from: string;
  to: string;
  documentType: string;
  documentNumber: string;
  search: string;
  sort: string;
  direction: string;
  page: number;
};

export function buildLedgerExplorerParams(filters: LedgerExplorerFilters) {
  const params: Record<string, string | number> = {
    sort: filters.sort,
    direction: filters.direction,
    page: filters.page,
    pageSize: 25,
  };
  const from = filters.from.trim();
  const to = filters.to.trim();
  const documentType = filters.documentType.trim();
  const documentNumber = filters.documentNumber.trim();
  const search = filters.search.trim();
  if (from) params.from = from;
  if (to) params.to = to;
  if (documentType) params.documentType = documentType;
  if (documentNumber) params.documentNumber = documentNumber;
  if (search) params.search = search;
  return params;
}

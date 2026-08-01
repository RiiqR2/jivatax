export function balancePath(companyId: string, taxPeriodId: string) {
  return `/companies/${companyId}/periods/${taxPeriodId}/balance`;
}

export function ledgerPath(
  companyId: string,
  taxPeriodId: string,
  accountId: string,
) {
  return `${balancePath(companyId, taxPeriodId)}/accounts/${accountId}/general-ledger`;
}

export function formatAccountingAmount(value: string | number) {
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export type BalanceExplorerFilters = {
  code: string;
  name: string;
  mapping: string;
  section: string;
  page: number;
};

export function buildBalanceExplorerParams(filters: BalanceExplorerFilters) {
  const params: Record<string, string | number> = {
    mapping: filters.mapping,
    page: filters.page,
    pageSize: 25,
  };
  const code = filters.code.trim();
  const name = filters.name.trim();
  if (code) params.code = code;
  if (name) params.name = name;
  if (filters.section) params.section = filters.section;
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

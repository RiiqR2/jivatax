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

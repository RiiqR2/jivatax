import type { TaxPeriod } from "@/types/accounting.types";

export function selectPreferredPeriod(periods: TaxPeriod[]): TaxPeriod | null {
  const activePeriods = periods.filter((period) => period.isActive);
  const candidates = activePeriods.length > 0 ? activePeriods : periods;

  return (
    [...candidates].sort(
      (left, right) =>
        right.taxYear - left.taxYear ||
        right.commercialYear - left.commercialYear,
    )[0] ?? null
  );
}

export function companyEntryPath(
  companyId: string,
  periods: TaxPeriod[],
  section: "dashboard" | "documents" = "dashboard",
): string {
  const period = selectPreferredPeriod(periods);

  if (!period) {
    return `/companies/${companyId}/periods/setup`;
  }

  return `/companies/${companyId}/periods/${period.id}/${section}`;
}

export function periodSelectionPath(
  pathname: string,
  companyId: string,
  taxPeriodId: string,
): string {
  if (/\/users\/?$/.test(pathname)) {
    return `/companies/${companyId}/users`;
  }

  const section = pathname.match(
    /\/(dashboard|documents|account-mapping)\/?$/,
  )?.[1];

  return `/companies/${companyId}/periods/${taxPeriodId}/${section ?? "dashboard"}`;
}

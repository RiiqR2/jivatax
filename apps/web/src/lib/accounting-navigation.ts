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

  // A ledger account belongs to a particular period. When switching periods,
  // return to the explorer root instead of carrying a potentially invalid ID.
  if (/\/balance\/accounts\/[^/]+\/general-ledger\/?$/.test(pathname)) {
    return `/companies/${companyId}/periods/${taxPeriodId}/balance`;
  }

  const section = pathname.match(
    /\/(dashboard|documents|account-mapping|balance)\/?$/,
  )?.[1];

  return `/companies/${companyId}/periods/${taxPeriodId}/${section ?? "dashboard"}`;
}

export function accountingExplorerPath(
  companyId: string,
  taxPeriodId: string,
): string {
  return `/companies/${companyId}/periods/${taxPeriodId}/balance`;
}

export function isValidTaxPeriodId(value: string | undefined): value is string {
  return Boolean(
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    ),
  );
}

export function isAccountingExplorerPath(pathname: string): boolean {
  return /\/periods\/[^/]+\/balance(?:\/|$)/.test(pathname);
}

export function explorerDocumentPath(
  companyId: string,
  taxPeriodId: string,
  document: {
    id: string;
    documentType: string;
    balanceRole?: string | null;
    status: string;
    discardedAt?: string | null;
  },
): string | null {
  if (
    !["processed", "superseded"].includes(document.status) ||
    document.discardedAt ||
    !["balance", "general_ledger"].includes(document.documentType)
  ) {
    return null;
  }

  const path = accountingExplorerPath(companyId, taxPeriodId);
  return document.documentType === "balance" &&
    document.balanceRole === "closing"
    ? `${path}?balanceDocumentId=${encodeURIComponent(document.id)}`
    : path;
}

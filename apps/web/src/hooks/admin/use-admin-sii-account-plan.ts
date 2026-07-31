"use client";

import { useQuery } from "@tanstack/react-query";
import { adminSiiAccountPlanService } from "@/services/admin-sii-account-plan.service";

export function useAdminSiiAccountPlanVersions() {
  return useQuery({
    queryKey: ["admin", "sii-account-plan", "versions"],
    queryFn: adminSiiAccountPlanService.listVersions,
  });
}

export function useAdminSiiAccounts(
  versionId: string,
  filters: { search?: string; page: number; limit: number },
) {
  return useQuery({
    queryKey: ["admin", "sii-account-plan", versionId, filters],
    queryFn: () => adminSiiAccountPlanService.listAccounts(versionId, filters),
    enabled: Boolean(versionId),
  });
}

export function useAdminAccountMatchingCoverage(versionId: string) {
  return useQuery({
    queryKey: ["admin", "sii-account-plan", versionId, "matching-coverage"],
    queryFn: () => adminSiiAccountPlanService.getMatchingCoverage(versionId),
    enabled: Boolean(versionId),
  });
}

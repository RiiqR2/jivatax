"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyAccountPlanService } from "@/services/company-account-plan.service";
import type {
  AssignCompanyAccountMappingInput,
  CompanyAccountFilters,
  ConfirmCompanyAccountMappingInput,
  ImportCompanyAccountPlanInput,
  RejectCompanyAccountMappingInput,
} from "@/types/company-account-plan.types";

export const companyAccountPlanKeys = {
  all: ["company-account-plan"] as const,
  versions: (companyId: string) =>
    [...companyAccountPlanKeys.all, companyId, "versions"] as const,
  version: (companyId: string, versionId: string) =>
    [...companyAccountPlanKeys.all, companyId, "version", versionId] as const,
  accounts: (
    companyId: string,
    versionId: string,
    filters: CompanyAccountFilters,
  ) =>
    [
      ...companyAccountPlanKeys.all,
      companyId,
      versionId,
      "accounts",
      filters,
    ] as const,
  mappings: (
    companyId: string,
    versionId: string,
    filters: CompanyAccountFilters,
  ) =>
    [
      ...companyAccountPlanKeys.all,
      companyId,
      versionId,
      "mappings",
      filters,
    ] as const,
};

export function useAccountPlanVersions(companyId: string) {
  return useQuery({
    queryKey: companyAccountPlanKeys.versions(companyId),
    queryFn: () => companyAccountPlanService.listVersions(companyId),
  });
}

export function useAccountPlanVersion(companyId: string, versionId: string) {
  return useQuery({
    queryKey: companyAccountPlanKeys.version(companyId, versionId),
    queryFn: () => companyAccountPlanService.getVersion(companyId, versionId),
  });
}

export function useCompanyAccounts(
  companyId: string,
  versionId: string,
  filters: CompanyAccountFilters,
) {
  return useQuery({
    queryKey: companyAccountPlanKeys.accounts(companyId, versionId, filters),
    queryFn: () =>
      companyAccountPlanService.listAccounts(companyId, versionId, filters),
  });
}

export function useImportAccountPlan(companyId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportCompanyAccountPlanInput) =>
      companyAccountPlanService.importPlan(companyId, input),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: companyAccountPlanKeys.versions(companyId),
      }),
  });
}

export function useMappingActions(companyId: string, versionId: string) {
  const client = useQueryClient();
  const invalidate = async () => {
    await client.invalidateQueries({
      queryKey: companyAccountPlanKeys.all,
    });
  };
  return {
    confirm: useMutation({
      mutationFn: ({
        mappingId,
        input,
      }: {
        mappingId: string;
        input: ConfirmCompanyAccountMappingInput;
      }) =>
        companyAccountPlanService.confirmMapping(companyId, mappingId, input),
      onSuccess: invalidate,
    }),
    reject: useMutation({
      mutationFn: ({
        mappingId,
        input,
      }: {
        mappingId: string;
        input: RejectCompanyAccountMappingInput;
      }) =>
        companyAccountPlanService.rejectMapping(companyId, mappingId, input),
      onSuccess: invalidate,
    }),
    assign: useMutation({
      mutationFn: ({
        mappingId,
        input,
      }: {
        mappingId: string;
        input: AssignCompanyAccountMappingInput;
      }) =>
        companyAccountPlanService.assignMapping(companyId, mappingId, input),
      onSuccess: invalidate,
    }),
    unmap: useMutation({
      mutationFn: (mappingId: string) =>
        companyAccountPlanService.unmapAccount(companyId, mappingId),
      onSuccess: invalidate,
    }),
    versionId,
  };
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminCompaniesService } from "@/services/admin-companies.service";
import type { CompanyFilters, CompanyInput } from "@/types/company.types";

const keys = {
  lists: ["admin", "companies"] as const,
  list: (filters: CompanyFilters) => ["admin", "companies", filters] as const,
  detail: (id: string) => ["admin", "companies", id] as const,
};

export function useAdminCompanies(filters: CompanyFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: () => adminCompaniesService.list(filters),
  });
}

export function useAdminCompany(id: string) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: () => adminCompaniesService.get(id),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useCreateAdminCompany() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      organizationId,
      input,
    }: {
      organizationId: string;
      input: CompanyInput;
    }) => adminCompaniesService.create(organizationId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.lists }),
  });
}

export function useUpdateAdminCompany(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CompanyInput) =>
      adminCompaniesService.update(id, input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.lists }),
        client.invalidateQueries({ queryKey: keys.detail(id) }),
      ]);
    },
  });
}

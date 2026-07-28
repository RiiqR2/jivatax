'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { companiesService } from '@/services/companies.service';
import type { CompanyFilters, CompanyInput } from '@/types/company.types';
export const companyKeys = { all: ['companies'] as const, lists: () => ['companies', 'list'] as const, list: (filters: CompanyFilters) => ['companies', 'list', filters] as const, detail: (id: string) => ['companies', 'detail', id] as const };
export function useCompanies(filters: CompanyFilters) { return useQuery({ queryKey: companyKeys.list(filters), queryFn: () => companiesService.list(filters) }); }
export function useCompany(id: string) { return useQuery({ queryKey: companyKeys.detail(id), queryFn: () => companiesService.get(id), enabled: Boolean(id), retry: false }); }
export function useCreateCompany() { const client = useQueryClient(); return useMutation({ mutationFn: companiesService.create, onSuccess: () => client.invalidateQueries({ queryKey: companyKeys.lists() }) }); }
export function useUpdateCompany(id: string) { const client = useQueryClient(); return useMutation({ mutationFn: (input: CompanyInput) => companiesService.update(id, input), onSuccess: async () => { await Promise.all([client.invalidateQueries({ queryKey: companyKeys.lists() }), client.invalidateQueries({ queryKey: companyKeys.detail(id) })]); } }); }

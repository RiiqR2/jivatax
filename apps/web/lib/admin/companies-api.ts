import { apiRequest } from '../http/api-client';
import { getCurrentOrganizationId } from './organization-context';
import type { Company, CompanyStatus } from './types';
export type CompanyInput = { rut: string; legalName: string; tradeName?: string; businessActivity?: string };
const root = () => `/organizations/${getCurrentOrganizationId()}/companies`;
export const companiesApi = {
 list: (filters?: { search?: string; status?: CompanyStatus }) => { const q = new URLSearchParams(Object.entries(filters ?? {}).filter(([,v]) => v) as string[][]); return apiRequest<Company[]>(`${root()}?${q}`); },
 create: (input: CompanyInput) => apiRequest<Company>(root(), { method: 'POST', body: JSON.stringify(input) }),
 update: (id: string, input: Partial<Omit<CompanyInput, 'rut'>> & { status?: CompanyStatus }) => apiRequest<Company>(`${root()}/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
};

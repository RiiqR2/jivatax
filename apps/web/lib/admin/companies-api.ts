import { apiRequest } from '../http/api-client';
import type { Company, CompanyStatus } from './types';
import { companiesRoute } from './api-routes';

export type CompanyInput = {
  rut: string;
  legalName: string;
  tradeName?: string;
  businessActivity?: string;
};

export const companiesApi = {
  list(organizationId: string, filters?: { search?: string; status?: CompanyStatus }) {
    const query = new URLSearchParams();
    if (filters?.search) query.set('search', filters.search);
    if (filters?.status) query.set('status', filters.status);
    const suffix = query.size ? `?${query.toString()}` : '';
    return apiRequest<Company[]>(`${companiesRoute(organizationId)}${suffix}`);
  },
  create: (organizationId: string, input: CompanyInput) =>
    apiRequest<Company>(companiesRoute(organizationId), { method: 'POST', body: JSON.stringify(input) }),
  update: (
    organizationId: string,
    id: string,
    input: Partial<Omit<CompanyInput, 'rut'>> & { status?: CompanyStatus },
  ) => apiRequest<Company>(companiesRoute(organizationId, id), {
    method: 'PATCH',
    body: JSON.stringify(input),
  }),
};

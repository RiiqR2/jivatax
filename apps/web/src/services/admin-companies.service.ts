import { api } from "@/lib/api";
import type {
  Company,
  CompanyFilters,
  CompanyInput,
  CompanyListResponse,
} from "@/types/company.types";

function companyPayload(input: CompanyInput) {
  return {
    legalName: input.legalName,
    tradeName: input.tradeName,
    taxId: input.taxId,
    status: input.status,
  };
}

export const adminCompaniesService = {
  async list(filters: CompanyFilters = {}) {
    const response = await api.get<CompanyListResponse>("/admin/companies", {
      params: filters,
    });
    return response.data;
  },

  async get(companyId: string) {
    const response = await api.get<Company>(`/admin/companies/${companyId}`);
    return response.data;
  },

  async create(organizationId: string, input: CompanyInput) {
    const payload = {
      organizationId,
      legalName: input.legalName,
      tradeName: input.tradeName,
      taxId: input.taxId,
    };
    const response = await api.post<Company>("/admin/companies", payload);
    return response.data;
  },

  async update(companyId: string, input: CompanyInput) {
    const response = await api.patch<Company>(
      `/admin/companies/${companyId}`,
      companyPayload(input),
    );
    return response.data;
  },
};

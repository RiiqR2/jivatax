import { api } from "@/lib/api";
import type {
  Company,
  CompanyFilters,
  CompanyInput,
  CompanyListResponse,
} from "@/types/company.types";

export const adminCompaniesService = {
  async list(filters: CompanyFilters & { organizationId?: string } = {}) {
    const response = await api.get<CompanyListResponse>("/admin/companies", {
      params: filters,
    });
    return response.data;
  },

  async create(input: CompanyInput & { organizationId: string }) {
    const response = await api.post<Company>("/admin/companies", input);
    return response.data;
  },

  async update(companyId: string, input: CompanyInput) {
    const response = await api.patch<Company>(
      `/admin/companies/${companyId}`,
      input,
    );
    return response.data;
  },
};

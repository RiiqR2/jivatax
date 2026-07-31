import { api } from "@/lib/api";
import type {
  Company,
  CompanyFilters,
  CompanyInput,
  CompanyListResponse,
} from "@/types/company.types";
export const companiesService = {
  async list(filters: CompanyFilters = {}) {
    return (
      await api.get<CompanyListResponse>("/companies", { params: filters })
    ).data;
  },
  async get(companyId: string) {
    return (await api.get<Company>(`/companies/${companyId}`)).data;
  },
  async create(input: CompanyInput) {
    const payload = {
      legalName: input.legalName,
      tradeName: input.tradeName,
      taxId: input.taxId,
      industryId: input.industryId ?? null,
    };
    return (await api.post<Company>("/companies", payload)).data;
  },
  async update(companyId: string, input: CompanyInput) {
    const payload = {
      legalName: input.legalName,
      tradeName: input.tradeName,
      taxId: input.taxId,
      status: input.status,
      industryId: input.industryId ?? null,
    };
    return (await api.patch<Company>(`/companies/${companyId}`, payload)).data;
  },
};

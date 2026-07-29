import { api } from "@/lib/api";
import type { AvailableCompany } from "@/types/active-company.types";

export const activeCompaniesService = {
  async list(): Promise<AvailableCompany[]> {
    return (await api.get<AvailableCompany[]>("/auth/me/companies")).data;
  },
};

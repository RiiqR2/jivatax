import { api } from "@/lib/api";
import type { CompanyUser } from "@/types/company-user.types";

export const companyUsersService = {
  async list(companyId: string): Promise<CompanyUser[]> {
    return (await api.get<CompanyUser[]>(`/companies/${companyId}/users`)).data;
  },
};

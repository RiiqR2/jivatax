import { api } from "@/lib/api";
import type {
  AdminSiiAccountPlanVersion,
  AdminSiiAccountsResponse,
  AdminAccountMatchingCoverage,
} from "@/types/admin-sii-account-plan.types";

export const adminSiiAccountPlanService = {
  async listVersions() {
    const response = await api.get<AdminSiiAccountPlanVersion[]>(
      "/admin/sii-account-plan/versions",
    );
    return response.data;
  },

  async listAccounts(
    versionId: string,
    filters: { search?: string; page: number; limit: number },
  ) {
    const params: { search?: string; page: number; limit: number } = {
      page: filters.page,
      limit: filters.limit,
    };
    if (filters.search) {
      params.search = filters.search;
    }
    const response = await api.get<AdminSiiAccountsResponse>(
      `/admin/sii-account-plan/versions/${versionId}/accounts`,
      { params },
    );
    return response.data;
  },

  async getMatchingCoverage(versionId: string) {
    const response = await api.get<AdminAccountMatchingCoverage>(
      `/admin/sii-account-plan/versions/${versionId}/matching-coverage`,
    );
    return response.data;
  },
};

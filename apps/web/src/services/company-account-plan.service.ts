import { api } from "@/lib/api";
import type {
  AssignCompanyAccountMappingInput,
  CompanyAccount,
  CompanyAccountFilters,
  CompanyAccountMapping,
  CompanyAccountPlanVersion,
  ConfirmCompanyAccountMappingInput,
  ImportCompanyAccountPlanInput,
  RejectCompanyAccountMappingInput,
} from "@/types/company-account-plan.types";

export const companyAccountPlanService = {
  async listVersions(companyId: string) {
    const response = await api.get<{ items: CompanyAccountPlanVersion[] }>(
      `/companies/${companyId}/account-plan/versions`,
    );
    return response.data;
  },

  async importPlan(companyId: string, input: ImportCompanyAccountPlanInput) {
    const payload = {
      storedFileId: input.storedFileId,
      name: input.name,
    };
    const response = await api.post<{
      versionId: string;
      status: string;
    }>(`/companies/${companyId}/account-plan/import`, payload);
    return response.data;
  },

  async getVersion(companyId: string, versionId: string) {
    const response = await api.get<CompanyAccountPlanVersion>(
      `/companies/${companyId}/account-plan/versions/${versionId}`,
    );
    return response.data;
  },

  async listAccounts(
    companyId: string,
    versionId: string,
    filters: CompanyAccountFilters,
  ) {
    const response = await api.get<{
      items: CompanyAccount[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>(`/companies/${companyId}/account-plan/versions/${versionId}/accounts`, {
      params: filters,
    });
    return response.data;
  },

  async listMappings(
    companyId: string,
    versionId: string,
    filters: CompanyAccountFilters,
  ) {
    const response = await api.get<{
      items: CompanyAccount[];
      pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    }>(`/companies/${companyId}/account-plan/versions/${versionId}/mappings`, {
      params: filters,
    });
    return response.data;
  },

  async confirmMapping(
    companyId: string,
    mappingId: string,
    input: ConfirmCompanyAccountMappingInput,
  ) {
    const payload = {
      notes: input.notes,
    };
    const response = await api.post<CompanyAccountMapping>(
      `/companies/${companyId}/account-plan/mappings/${mappingId}/confirm`,
      payload,
    );
    return response.data;
  },

  async rejectMapping(
    companyId: string,
    mappingId: string,
    input: RejectCompanyAccountMappingInput,
  ) {
    const payload = {
      notes: input.notes,
    };
    const response = await api.post<CompanyAccountMapping>(
      `/companies/${companyId}/account-plan/mappings/${mappingId}/reject`,
      payload,
    );
    return response.data;
  },

  async assignMapping(
    companyId: string,
    mappingId: string,
    input: AssignCompanyAccountMappingInput,
  ) {
    const payload = {
      siiAccountId: input.siiAccountId,
      notes: input.notes,
    };
    const response = await api.patch<CompanyAccountMapping>(
      `/companies/${companyId}/account-plan/mappings/${mappingId}`,
      payload,
    );
    return response.data;
  },

  async unmapAccount(companyId: string, mappingId: string) {
    const response = await api.post<CompanyAccountMapping>(
      `/companies/${companyId}/account-plan/mappings/${mappingId}/unmap`,
    );
    return response.data;
  },
};

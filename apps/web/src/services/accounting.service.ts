import { api } from "@/lib/api";
import type {
  TaxDocument,
  TaxDocumentReport,
  TaxDocumentType,
  TaxPeriod,
  AccountMappingsResponse,
} from "@/types/accounting.types";
import type {
  BalanceAccount,
  LedgerResponse,
  Paginated,
} from "@/types/accounting-explorer.types";

export const accountingService = {
  async explorerBalance(
    companyId: string,
    periodId: string,
    params: Record<string, string | number | undefined>,
  ): Promise<Paginated<BalanceAccount>> {
    return (
      await api.get(
        `/companies/${companyId}/tax-periods/${periodId}/accounting-explorer/balance`,
        { params },
      )
    ).data;
  },
  async explorerLedger(
    companyId: string,
    periodId: string,
    accountId: string,
    params: Record<string, string | number | undefined>,
  ): Promise<LedgerResponse> {
    return (
      await api.get(
        `/companies/${companyId}/tax-periods/${periodId}/accounting-explorer/accounts/${accountId}/general-ledger`,
        { params },
      )
    ).data;
  },
  async periods(companyId: string): Promise<TaxPeriod[]> {
    const response = await api.get<TaxPeriod[]>(
      `/companies/${companyId}/tax-periods`,
    );
    return response.data;
  },
  async createPeriod(
    companyId: string,
    values: {
      commercialYear: number;
      taxYear: number;
      startDate: string;
      endDate: string;
    },
  ): Promise<TaxPeriod> {
    const payload = {
      commercialYear: values.commercialYear,
      taxYear: values.taxYear,
      startDate: values.startDate,
      endDate: values.endDate,
    };
    const response = await api.post<TaxPeriod>(
      `/companies/${companyId}/tax-periods`,
      payload,
    );
    return response.data;
  },
  async documents(
    companyId: string,
    periodId: string,
    documentType?: TaxDocumentType,
  ): Promise<TaxDocument[]> {
    const response = await api.get<TaxDocument[]>(
      `/companies/${companyId}/tax-periods/${periodId}/documents`,
      {
        params: documentType
          ? {
              documentType,
            }
          : undefined,
      },
    );
    return response.data;
  },
  async createDocument(
    companyId: string,
    periodId: string,
    documentType: TaxDocumentType,
    storedFileId: string,
  ): Promise<TaxDocument> {
    const payload = {
      documentType,
      storedFileId,
    };
    const response = await api.post<TaxDocument>(
      `/companies/${companyId}/tax-periods/${periodId}/documents`,
      payload,
    );
    return response.data;
  },
  async processDocument(
    companyId: string,
    periodId: string,
    documentId: string,
  ): Promise<TaxDocumentReport> {
    const response = await api.post<TaxDocumentReport>(
      `/companies/${companyId}/tax-periods/${periodId}/documents/${documentId}/process`,
      {},
    );
    return response.data;
  },
  async document(
    companyId: string,
    periodId: string,
    documentId: string,
  ): Promise<TaxDocument> {
    const response = await api.get<TaxDocument>(
      `/companies/${companyId}/tax-periods/${periodId}/documents/${documentId}`,
    );
    return response.data;
  },
  async report(
    companyId: string,
    periodId: string,
    documentId: string,
  ): Promise<TaxDocumentReport> {
    const response = await api.get<TaxDocumentReport>(
      `/companies/${companyId}/tax-periods/${periodId}/documents/${documentId}/report`,
    );
    return response.data;
  },
  async getTaxDocumentReport(
    companyId: string,
    periodId: string,
    documentId: string,
  ): Promise<TaxDocumentReport> {
    return this.report(companyId, periodId, documentId);
  },
  async discardDocument(
    companyId: string,
    periodId: string,
    documentId: string,
    reason: string,
  ) {
    const response = await api.post(
      `/companies/${companyId}/tax-periods/${periodId}/documents/${documentId}/discard`,
      { reason },
    );
    return response.data;
  },
  async accountMappings(
    companyId: string,
    periodId: string,
    filters: {
      status?: string;
      search?: string;
      newInPeriod?: boolean;
      nameChanged?: boolean;
      page?: number;
      limit?: number;
      documentId?: string;
    },
  ): Promise<AccountMappingsResponse> {
    const response = await api.get<AccountMappingsResponse>(
      `/companies/${companyId}/tax-periods/${periodId}/account-mappings`,
      { params: filters },
    );
    return response.data;
  },
  async updateAccountMapping(
    companyId: string,
    companyAccountId: string,
    action: "confirm" | "reject",
    siiAccountId?: string,
  ) {
    const payload =
      action === "confirm" ? { action, siiAccountId } : { action };
    const response = await api.put(
      `/companies/${companyId}/company-accounts/${companyAccountId}/mapping`,
      payload,
    );
    return response.data;
  },
  async generateAccountSuggestions(companyId: string, periodId: string) {
    const response = await api.post(
      `/companies/${companyId}/tax-periods/${periodId}/account-mapping-suggestions`,
    );
    return response.data;
  },
  async approveAccountSuggestions(
    companyId: string,
    periodId: string,
    companyAccountIds: string[],
  ) {
    const response = await api.post(
      `/companies/${companyId}/tax-periods/${periodId}/account-mappings/suggestions/approve-batch`,
      { companyAccountIds },
    );
    return response.data;
  },
  async mappingHistory(companyId: string, companyAccountId: string) {
    const response = await api.get<{ items: Array<Record<string, unknown>> }>(
      `/companies/${companyId}/company-accounts/${companyAccountId}/mapping-history`,
    );
    return response.data;
  },
  async siiAccounts(search: string) {
    const response = await api.get<{
      items: Array<{ id: string; code: string; name: string }>;
    }>("/sii/account-plan/accounts", { params: { search, pageSize: 25 } });
    return response.data.items;
  },
  templateUrl(companyId: string, type: TaxDocumentType): string {
    const path = type === "general_ledger" ? "general-ledger" : type;
    return `${api.defaults.baseURL}/companies/${companyId}/document-templates/${path}`;
  },
};

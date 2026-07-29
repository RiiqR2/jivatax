import { api } from "@/lib/api";
import type {
  TaxDocument,
  TaxDocumentType,
  TaxPeriod,
} from "@/types/accounting.types";

export const accountingService = {
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
  async documents(companyId: string, periodId: string): Promise<TaxDocument[]> {
    const response = await api.get<TaxDocument[]>(
      `/companies/${companyId}/tax-periods/${periodId}/documents`,
    );
    return response.data;
  },
  templateUrl(companyId: string, type: TaxDocumentType): string {
    const path = type === "general_ledger" ? "general-ledger" : type;
    return `${api.defaults.baseURL}/companies/${companyId}/document-templates/${path}`;
  },
};

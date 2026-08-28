import { api } from "@/lib/api";
import type {
  A17ManualInput,
  ApplicableWorkPaper,
  WorkPaperCalculationJobResponse,
  WorkPaperExecutionDetail,
  WorkPaperJobSummary,
  WorkPaperPeriodSummaryRow,
} from "@/types/work-papers.types";

function workPapersBase(companyId: string, taxPeriodId: string): string {
  return `/companies/${companyId}/tax-periods/${taxPeriodId}/work-papers`;
}

export const workPapersService = {
  async applicable(
    companyId: string,
    taxPeriodId: string,
  ): Promise<ApplicableWorkPaper[]> {
    const response = await api.get<ApplicableWorkPaper[]>(
      `${workPapersBase(companyId, taxPeriodId)}/applicable`,
    );
    return response.data;
  },

  async summary(
    companyId: string,
    taxPeriodId: string,
  ): Promise<WorkPaperPeriodSummaryRow[]> {
    const response = await api.get<WorkPaperPeriodSummaryRow[]>(
      `${workPapersBase(companyId, taxPeriodId)}/summary`,
    );
    return response.data;
  },

  async createExecution(
    companyId: string,
    taxPeriodId: string,
    definitionId: string,
  ): Promise<{ id: string }> {
    const payload = { definitionId };
    const response = await api.post<{ id: string }>(
      `${workPapersBase(companyId, taxPeriodId)}/executions`,
      payload,
    );
    return response.data;
  },

  async execution(
    companyId: string,
    taxPeriodId: string,
    executionId: string,
  ): Promise<WorkPaperExecutionDetail> {
    const response = await api.get<WorkPaperExecutionDetail>(
      `${workPapersBase(companyId, taxPeriodId)}/executions/${executionId}`,
    );
    return response.data;
  },

  async job(
    companyId: string,
    taxPeriodId: string,
    jobId: string,
  ): Promise<WorkPaperJobSummary> {
    const response = await api.get<WorkPaperJobSummary>(
      `${workPapersBase(companyId, taxPeriodId)}/jobs/${jobId}`,
    );
    return response.data;
  },

  async startCalculation(
    companyId: string,
    taxPeriodId: string,
    executionId: string,
    manualInputs: A17ManualInput[],
  ): Promise<WorkPaperCalculationJobResponse> {
    const payload = {
      manualInputs: manualInputs.map((item) => {
        if (item.description) {
          return {
            inputKey: item.inputKey,
            value: item.value,
            description: item.description,
          };
        }
        return { inputKey: item.inputKey, value: item.value };
      }),
    };
    const response = await api.post<WorkPaperCalculationJobResponse>(
      `${workPapersBase(companyId, taxPeriodId)}/executions/${executionId}/calculations`,
      payload,
    );
    return response.data;
  },
};

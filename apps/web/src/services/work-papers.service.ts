import { api } from "@/lib/api";
import type {
  A17ManualInput,
  ApplicableWorkPaper,
  WorkPaperExecutionDetail,
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

  async calculateA17(
    companyId: string,
    taxPeriodId: string,
    executionId: string,
    manualInputs: A17ManualInput[],
  ): Promise<WorkPaperExecutionDetail> {
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
    const response = await api.post<WorkPaperExecutionDetail>(
      `${workPapersBase(companyId, taxPeriodId)}/executions/${executionId}/calculate`,
      payload,
    );
    return response.data;
  },
};

import type { WorkPaperJobEntity } from "./entities/work-paper-job.entity";
import type { WorkPaperExecutionEntity } from "./entities/work-paper-execution.entity";
import type { TaxAdjustmentEntity } from "./entities/tax-adjustment.entity";
import {
  WorkPaperExecutionStatus,
  WorkPaperJobStatus,
} from "./tax-work-paper.enums";

export interface WorkPaperPeriodSummaryRow {
  definitionId: string;
  code: string;
  name: string;
  definitionVersion: number;
  executionStatus: "not_started" | "draft" | "finalized";
  latestExecutionId: string | null;
  latestExecutionRevision: number | null;
  latestJobId: string | null;
  latestJobStatus: WorkPaperJobStatus | null;
  missingInputsCount: number;
  reconciliationWarningsCount: number;
  requiresProfessionalReview: boolean;
  proposedAdjustmentsCount: number;
  proposedAdjustmentsTotal: string | null;
}

function parseResultMetrics(snapshot: Record<string, unknown> | null): {
  missingInputsCount: number;
  reconciliationWarningsCount: number;
  requiresProfessionalReview: boolean;
} {
  if (!snapshot) {
    return {
      missingInputsCount: 0,
      reconciliationWarningsCount: 0,
      requiresProfessionalReview: false,
    };
  }
  const missingInputs = Array.isArray(snapshot.missingInputs)
    ? snapshot.missingInputs.length
    : 0;
  const reconciliations = Array.isArray(snapshot.reconciliations)
    ? snapshot.reconciliations.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          (item as { status?: string }).status === "warning",
      ).length
    : 0;
  const calculatedValues =
    snapshot.calculatedValues && typeof snapshot.calculatedValues === "object"
      ? (snapshot.calculatedValues as Record<string, unknown>)
      : null;
  return {
    missingInputsCount: missingInputs,
    reconciliationWarningsCount: reconciliations,
    requiresProfessionalReview:
      calculatedValues?.requiresProfessionalReview === true,
  };
}

export function buildPeriodSummaryRows(
  applicable: Array<{
    definitionId: string;
    code: string;
    name: string;
    definitionVersion: number;
    executions: Array<{
      id: string;
      status: WorkPaperExecutionStatus;
      revision: number;
    }>;
  }>,
  executionDetails: Map<
    string,
    Pick<WorkPaperExecutionEntity, "id" | "resultSnapshot">
  >,
  latestJobs: Map<string, WorkPaperJobEntity>,
  adjustmentStats: Map<
    string,
    Pick<TaxAdjustmentEntity, "executionId"> & {
      count: number;
      total: string | null;
    }
  >,
): WorkPaperPeriodSummaryRow[] {
  return applicable.map((paper) => {
    const latestExecution =
      paper.executions.length === 0
        ? null
        : [...paper.executions].sort(
            (left, right) => right.revision - left.revision,
          )[0];
    const executionDetail = latestExecution
      ? executionDetails.get(latestExecution.id)
      : null;
    const snapshot =
      executionDetail?.resultSnapshot &&
      typeof executionDetail.resultSnapshot === "object"
        ? (executionDetail.resultSnapshot as Record<string, unknown>)
        : null;
    const metrics = parseResultMetrics(snapshot);
    const latestJob = latestExecution
      ? (latestJobs.get(latestExecution.id) ?? null)
      : null;
    const adjustments = latestExecution
      ? adjustmentStats.get(latestExecution.id)
      : undefined;

    let executionStatus: WorkPaperPeriodSummaryRow["executionStatus"] =
      "not_started";
    if (latestExecution?.status === WorkPaperExecutionStatus.DRAFT)
      executionStatus = "draft";
    if (latestExecution?.status === WorkPaperExecutionStatus.FINALIZED)
      executionStatus = "finalized";

    return {
      definitionId: paper.definitionId,
      code: paper.code,
      name: paper.name,
      definitionVersion: paper.definitionVersion,
      executionStatus,
      latestExecutionId: latestExecution?.id ?? null,
      latestExecutionRevision: latestExecution?.revision ?? null,
      latestJobId: latestJob?.id ?? null,
      latestJobStatus: latestJob?.status ?? null,
      missingInputsCount: metrics.missingInputsCount,
      reconciliationWarningsCount: metrics.reconciliationWarningsCount,
      requiresProfessionalReview: metrics.requiresProfessionalReview,
      proposedAdjustmentsCount: adjustments?.count ?? 0,
      proposedAdjustmentsTotal: adjustments?.total ?? null,
    };
  });
}

import { WorkPaperExecutionDetail } from "@/components/work-papers/work-paper-execution-detail";

export default async function WorkPaperExecutionPage({
  params,
}: {
  params: Promise<{
    companyId: string;
    taxPeriodId: string;
    executionId: string;
  }>;
}) {
  const { companyId, taxPeriodId, executionId } = await params;
  return (
    <WorkPaperExecutionDetail
      companyId={companyId}
      taxPeriodId={taxPeriodId}
      executionId={executionId}
    />
  );
}

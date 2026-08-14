import { WorkPapersList } from "@/components/work-papers/work-papers-list";

export default async function WorkPapersPage({
  params,
}: {
  params: Promise<{ companyId: string; taxPeriodId: string }>;
}) {
  const { companyId, taxPeriodId } = await params;
  return <WorkPapersList companyId={companyId} taxPeriodId={taxPeriodId} />;
}

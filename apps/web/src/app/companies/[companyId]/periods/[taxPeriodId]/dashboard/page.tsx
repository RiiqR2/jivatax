import { PeriodDashboard } from "@/components/accounting/period-dashboard";

export default async function PeriodDashboardPage({
  params,
}: {
  params: Promise<{ companyId: string; taxPeriodId: string }>;
}) {
  const { companyId, taxPeriodId } = await params;

  return <PeriodDashboard companyId={companyId} taxPeriodId={taxPeriodId} />;
}

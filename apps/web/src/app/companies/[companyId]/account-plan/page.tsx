import { AccountPlanOverview } from "@/components/company-account-plan/account-plan-overview";

export default async function AccountPlanPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return <AccountPlanOverview companyId={companyId} />;
}

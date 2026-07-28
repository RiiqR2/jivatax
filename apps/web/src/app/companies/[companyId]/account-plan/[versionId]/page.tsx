import { AccountPlanReview } from "@/components/company-account-plan/account-plan-review";

export default async function AccountPlanReviewPage({
  params,
}: {
  params: Promise<{
    companyId: string;
    versionId: string;
  }>;
}) {
  const { companyId, versionId } = await params;
  return <AccountPlanReview companyId={companyId} versionId={versionId} />;
}

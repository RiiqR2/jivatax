import { AccountPlanImport } from "@/components/company-account-plan/account-plan-import";

export default async function AccountPlanImportPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  return <AccountPlanImport companyId={companyId} />;
}

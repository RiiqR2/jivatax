import { CompanyContextResolver } from "@/components/accounting/company-context-resolver";

export default async function LegacyCompanyDashboardPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  return <CompanyContextResolver companyId={companyId} />;
}

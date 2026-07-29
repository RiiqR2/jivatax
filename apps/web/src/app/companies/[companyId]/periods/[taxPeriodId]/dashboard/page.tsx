import CompanyDashboardPage from "../../../dashboard/page";

export default async function PeriodDashboardPage({
  params,
}: {
  params: Promise<{ companyId: string; taxPeriodId: string }>;
}) {
  const values = await params;
  return (
    <CompanyDashboardPage
      params={Promise.resolve({
        companyId: `${values.companyId}:${values.taxPeriodId}`,
      })}
    />
  );
}

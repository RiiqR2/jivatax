import CompanyUsersPage from "../../../users/page";

export default async function PeriodUsersPage({
  params,
}: {
  params: Promise<{ companyId: string; taxPeriodId: string }>;
}) {
  const { companyId } = await params;
  return <CompanyUsersPage params={Promise.resolve({ companyId })} />;
}

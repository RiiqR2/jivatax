import { redirect } from "next/navigation";

export default async function LegacyPeriodUsersPage({
  params,
}: {
  params: Promise<{ companyId: string; taxPeriodId: string }>;
}) {
  const { companyId } = await params;

  redirect(`/companies/${companyId}/users`);
}

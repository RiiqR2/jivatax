import { BalanceExplorer } from "@/components/accounting/accounting-explorer";
export default async function BalancePage({
  params,
}: {
  params: Promise<{ companyId: string; taxPeriodId: string }>;
}) {
  const values = await params;
  return <BalanceExplorer {...values} />;
}

import { GeneralLedgerExplorer } from "@/components/accounting/accounting-explorer";
export default async function LedgerPage({
  params,
}: {
  params: Promise<{
    companyId: string;
    taxPeriodId: string;
    accountId: string;
  }>;
}) {
  const values = await params;
  return <GeneralLedgerExplorer {...values} />;
}

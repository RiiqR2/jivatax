import { TaxPeriodSetup } from "@/components/accounting/tax-period-setup";

export default async function TaxPeriodSetupPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  return <TaxPeriodSetup companyId={companyId} />;
}

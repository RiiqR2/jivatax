import { AccountingDocumentsPage } from "@/components/accounting/documents-page";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ companyId: string; taxPeriodId: string }>;
}) {
  const { companyId, taxPeriodId } = await params;
  return (
    <AccountingDocumentsPage companyId={companyId} taxPeriodId={taxPeriodId} />
  );
}

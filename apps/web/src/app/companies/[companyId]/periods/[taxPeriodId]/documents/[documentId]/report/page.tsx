import { DocumentReportPage } from "@/components/accounting/document-report-page";

export default async function ReportPage({
  params,
}: {
  params: Promise<{
    companyId: string;
    taxPeriodId: string;
    documentId: string;
  }>;
}) {
  const { companyId, taxPeriodId, documentId } = await params;
  return (
    <DocumentReportPage
      companyId={companyId}
      taxPeriodId={taxPeriodId}
      documentId={documentId}
    />
  );
}

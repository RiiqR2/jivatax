import { DocumentDetailPage } from "@/components/accounting/document-detail-page";

export default async function DocumentPage({
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
    <DocumentDetailPage
      companyId={companyId}
      taxPeriodId={taxPeriodId}
      documentId={documentId}
    />
  );
}

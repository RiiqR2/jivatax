import { CompanyContextResolver } from "@/components/accounting/company-context-resolver";

export default async function LegacyCompanyDocumentsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

  return <CompanyContextResolver companyId={companyId} section="documents" />;
}

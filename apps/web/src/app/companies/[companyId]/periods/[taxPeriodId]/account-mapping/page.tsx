import { Suspense } from "react";
import { AccountMappingPage } from "@/components/accounting/account-mapping-page";

export default async function MappingPage({
  params,
}: {
  params: Promise<{ companyId: string; taxPeriodId: string }>;
}) {
  const { companyId, taxPeriodId } = await params;
  return (
    <Suspense fallback={<main className="p-8">Cargando homologaciones…</main>}>
      <AccountMappingPage companyId={companyId} taxPeriodId={taxPeriodId} />
    </Suspense>
  );
}

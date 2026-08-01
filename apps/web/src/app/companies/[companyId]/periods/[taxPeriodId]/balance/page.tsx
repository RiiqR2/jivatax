import { BalanceExplorer } from "@/components/accounting/accounting-explorer";
import Link from "next/link";
import { isValidTaxPeriodId } from "@/lib/accounting-navigation";
export default async function BalancePage({
  params,
}: {
  params: Promise<{ companyId: string; taxPeriodId: string }>;
}) {
  const values = await params;
  if (!isValidTaxPeriodId(values.taxPeriodId)) {
    return (
      <main className="mx-auto max-w-3xl p-6 sm:p-8">
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h1 className="text-2xl font-semibold text-slate-950">
            Configura un período tributario
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Debes crear o seleccionar un período antes de abrir el Explorador
            contable.
          </p>
          <Link
            href={`/companies/${values.companyId}/periods/setup`}
            className="mt-5 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Crear período tributario
          </Link>
        </section>
      </main>
    );
  }
  return <BalanceExplorer {...values} />;
}

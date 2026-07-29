export interface DashboardDemoData {
  documentsProcessed: number;
  mappedAccountsPercentage: number;
  pendingReviews: number;
  taxBalanceProgress: number;
  monthlyDocuments: Array<{ month: string; documents: number }>;
  mappingStatus: Array<{ label: string; value: number; color: string }>;
  recentActivity: Array<{ title: string; detail: string; time: string }>;
}

const months = ["Feb", "Mar", "Abr", "May", "Jun", "Jul"];

// DATOS SOLO PARA LA DEMO: reemplazar por endpoints reales del dashboard.
export function getDemoDashboardData(companyId: string): DashboardDemoData {
  const seed = [...companyId].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) % 10_007,
    17,
  );
  const mapped = 58 + (seed % 36);
  const pending = 3 + (seed % 15);
  const monthlyDocuments = months.map((month, index) => ({
    month,
    documents: 24 + ((seed * (index + 3) + index * 17) % 74),
  }));

  return {
    documentsProcessed: monthlyDocuments.reduce(
      (total, item) => total + item.documents,
      0,
    ),
    mappedAccountsPercentage: mapped,
    pendingReviews: pending,
    taxBalanceProgress: 42 + (seed % 51),
    monthlyDocuments,
    mappingStatus: [
      { label: "Homologadas", value: mapped, color: "bg-emerald-600" },
      { label: "En revisión", value: pending, color: "bg-amber-500" },
      {
        label: "Pendientes",
        value: Math.max(0, 100 - mapped - pending),
        color: "bg-slate-300",
      },
    ],
    recentActivity: [
      {
        title: "Plan de cuentas actualizado",
        detail: `${12 + (seed % 20)} cuentas revisadas`,
        time: "Hoy, 09:42",
      },
      {
        title: "Documentos procesados",
        detail: `${8 + (seed % 14)} documentos incorporados`,
        time: "Ayer, 16:18",
      },
      {
        title: "Homologación confirmada",
        detail: "Proceso de revisión tributaria",
        time: "Hace 2 días",
      },
    ],
  };
}

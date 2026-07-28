import { StatusBadge } from "@/components/shared/status-badge";
import type { CompanyStatus } from "@/types/company.types";
export function CompanyStatusBadge({ status }: { status: CompanyStatus }) {
  return (
    <StatusBadge variant={status === "active" ? "success" : "neutral"}>
      {status === "active" ? "Activa" : "Inactiva"}
    </StatusBadge>
  );
}

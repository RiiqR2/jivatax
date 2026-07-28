"use client";

import { useQuery } from "@tanstack/react-query";
import { adminOrganizationsService } from "@/services/admin-organizations.service";

export function useAdminOrganizations() {
  return useQuery({
    queryKey: ["admin-organizations"],
    queryFn: adminOrganizationsService.list,
    staleTime: 60_000,
  });
}

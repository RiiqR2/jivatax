import { api } from "@/lib/api";
import type { AdminOrganization } from "@/types/admin-user.types";

export const adminOrganizationsService = {
  async list() {
    const response = await api.get<{ items: AdminOrganization[] }>(
      "/admin/organizations",
    );
    return response.data;
  },
};

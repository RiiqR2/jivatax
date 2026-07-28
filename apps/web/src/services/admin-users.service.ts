import { api } from "@/lib/api";
import type {
  AdminUser,
  AdminUserFilters,
  AdminUserInput,
  AdminUserListResponse,
  MembershipStatus,
  OrganizationRole,
} from "@/types/admin-user.types";

export const adminUsersService = {
  async list(filters: AdminUserFilters = {}) {
    const response = await api.get<AdminUserListResponse>("/admin/users", {
      params: filters,
    });
    return response.data;
  },

  async get(userId: string) {
    const response = await api.get<AdminUser>(`/admin/users/${userId}`);
    return response.data;
  },

  async create(input: AdminUserInput) {
    const response = await api.post<AdminUser>("/admin/users", input);
    return response.data;
  },

  async update(userId: string, input: AdminUserInput) {
    const response = await api.patch<AdminUser>(
      `/admin/users/${userId}`,
      input,
    );
    return response.data;
  },

  async addMembership(
    userId: string,
    input: {
      organizationId: string;
      role: OrganizationRole;
    },
  ) {
    const response = await api.post(
      `/admin/users/${userId}/memberships`,
      input,
    );
    return response.data;
  },

  async updateMembership(
    userId: string,
    membershipId: string,
    input: {
      role?: OrganizationRole;
      status?: MembershipStatus;
    },
  ) {
    const response = await api.patch(
      `/admin/users/${userId}/memberships/${membershipId}`,
      input,
    );
    return response.data;
  },
};

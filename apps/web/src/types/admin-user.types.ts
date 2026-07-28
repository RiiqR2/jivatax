export type UserPlatformRole = "user" | "metauser";
export type UserStatus = "active" | "inactive" | "blocked";
export type OrganizationRole =
  "owner" | "admin" | "accountant" | "auditor" | "viewer";
export type MembershipStatus = "invited" | "active" | "suspended";

export interface AdminUserMembership {
  membershipId: string;
  id: string;
  name: string;
  role: OrganizationRole;
  status: MembershipStatus;
}

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: UserStatus;
  platformRole: UserPlatformRole;
  lastLoginAt: string | null;
  organizations: AdminUserMembership[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: UserStatus;
  platformRole?: UserPlatformRole;
  organizationId?: string;
}

export interface AdminUserListResponse {
  items: AdminUser[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminOrganization {
  id: string;
  name: string;
  status: "active" | "inactive";
}

export interface AdminUserInput {
  email?: string;
  firstName: string;
  lastName: string;
  platformRole: UserPlatformRole;
  status?: UserStatus;
  temporaryPassword?: string;
  memberships?: Array<{
    organizationId: string;
    role: OrganizationRole;
  }>;
}

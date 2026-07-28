import { OrganizationMemberEntity } from "../../../organizations/entities/organization-member.entity";
import { UserEntity } from "../../../users/entities/user.entity";

export function presentAdminUser(user: UserEntity) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    status: user.status,
    platformRole: user.platformRole,
    lastLoginAt: user.lastLoginAt,
    organizations: (user.organizationMembers ?? []).map(presentMembership),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function presentMembership(membership: OrganizationMemberEntity) {
  return {
    membershipId: membership.id,
    id: membership.organizationId,
    name: membership.organization.name,
    role: membership.role,
    status: membership.status,
  };
}

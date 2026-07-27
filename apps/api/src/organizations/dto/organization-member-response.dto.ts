import { OrganizationMemberEntity } from '../entities/organization-member.entity';
import { OrganizationMemberStatus } from '../enums/organization-member-status.enum';
import { OrganizationRole } from '../enums/organization-role.enum';

export class OrganizationMemberResponseDto {
  userId!: string;
  membershipId!: string;
  firstName!: string;
  lastName!: string;
  email!: string;
  role!: OrganizationRole;
  status!: OrganizationMemberStatus;
  joinedAt!: Date | null;
  lastLoginAt!: Date | null;

  static fromEntity(member: OrganizationMemberEntity): OrganizationMemberResponseDto {
    return {
      userId: member.userId,
      membershipId: member.id,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      email: member.user.email,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
      lastLoginAt: member.user.lastLoginAt,
    };
  }
}

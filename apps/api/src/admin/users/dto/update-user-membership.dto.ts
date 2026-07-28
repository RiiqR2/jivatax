import { IsEnum, IsOptional, IsUUID } from "class-validator";
import { OrganizationMemberStatus } from "../../../organizations/enums/organization-member-status.enum";
import { OrganizationRole } from "../../../organizations/enums/organization-role.enum";

export class AddUserMembershipDto {
  @IsUUID()
  organizationId!: string;

  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}

export class UpdateUserMembershipDto {
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  @IsOptional()
  @IsEnum(OrganizationMemberStatus)
  status?: OrganizationMemberStatus;
}

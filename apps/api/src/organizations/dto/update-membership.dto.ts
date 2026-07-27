import { IsEnum, IsOptional } from 'class-validator';
import { OrganizationMemberStatus } from '../enums/organization-member-status.enum';
import { OrganizationRole } from '../enums/organization-role.enum';
export class UpdateMembershipDto {
  @IsOptional() @IsEnum(OrganizationRole) role?: OrganizationRole;
  @IsOptional() @IsEnum(OrganizationMemberStatus) status?: OrganizationMemberStatus;
}

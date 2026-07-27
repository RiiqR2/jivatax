import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrganizationMemberStatus } from '../enums/organization-member-status.enum';
import { OrganizationRole } from '../enums/organization-role.enum';
export class ListOrganizationUsersQueryDto {
 @IsOptional() @IsString() @MaxLength(255) search?: string;
 @IsOptional() @IsEnum(OrganizationRole) role?: OrganizationRole;
 @IsOptional() @IsEnum(OrganizationMemberStatus) status?: OrganizationMemberStatus;
}

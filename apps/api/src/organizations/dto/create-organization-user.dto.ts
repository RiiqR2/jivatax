import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { OrganizationRole } from '../enums/organization-role.enum';
export class CreateOrganizationUserDto {
  @IsEmail() @MaxLength(255) email!: string;
  @IsString() @MinLength(1) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(1) @MaxLength(100) lastName!: string;
  @IsEnum(OrganizationRole) role!: OrganizationRole;
}

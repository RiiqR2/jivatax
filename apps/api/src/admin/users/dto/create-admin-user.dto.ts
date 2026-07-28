import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { OrganizationRole } from "../../../organizations/enums/organization-role.enum";
import { UserPlatformRole } from "../../../users/entities/user.entity";

export class CreateUserMembershipDto {
  @IsUUID()
  organizationId!: string;

  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}

export class CreateAdminUserDto {
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  firstName!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  lastName!: string;

  @IsOptional()
  @IsEnum(UserPlatformRole)
  platformRole: UserPlatformRole = UserPlatformRole.User;

  @IsString()
  @Length(12, 128)
  temporaryPassword!: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique(
    (membership: CreateUserMembershipDto) => membership.organizationId,
  )
  @ValidateNested({ each: true })
  @Type(() => CreateUserMembershipDto)
  memberships: CreateUserMembershipDto[] = [];
}

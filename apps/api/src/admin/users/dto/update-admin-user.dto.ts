import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, Length } from "class-validator";
import {
  UserPlatformRole,
  UserStatus,
} from "../../../users/entities/user.entity";

export class UpdateAdminUserDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  firstName?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(1, 100)
  lastName?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(UserPlatformRole)
  platformRole?: UserPlatformRole;
}

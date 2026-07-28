import { Transform } from 'class-transformer';
import { IsEmail, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class SelectOrganizationDto {
  @IsUUID()
  organizationId!: string;
}

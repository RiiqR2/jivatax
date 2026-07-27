import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString() @Matches(/^[0-9.]+-[0-9kK]$/, { message: 'El RUT no tiene un formato válido.' }) @MaxLength(14) rut!: string;
  @IsString() @MinLength(2) @MaxLength(255) legalName!: string;
  @IsOptional() @IsString() @MaxLength(255) tradeName?: string;
  @IsOptional() @IsString() @MaxLength(255) businessActivity?: string;
}

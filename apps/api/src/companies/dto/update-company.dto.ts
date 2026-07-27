import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CompanyStatus } from '../enums/company-status.enum';

export class UpdateCompanyDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(255) legalName?: string;
  @IsOptional() @IsString() @MaxLength(255) tradeName?: string;
  @IsOptional() @IsString() @MaxLength(255) businessActivity?: string;
  @IsOptional() @IsEnum(CompanyStatus) status?: CompanyStatus;
}

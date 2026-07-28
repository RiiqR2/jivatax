import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CompanyStatus } from '../enums/company-status.enum';
export class ListCompaniesQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(CompanyStatus) status?: CompanyStatus;
}

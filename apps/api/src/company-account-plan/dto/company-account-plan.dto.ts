import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  CompanyAccountMappingMethod,
  CompanyAccountMappingStatus,
} from "../enums/company-account-plan.enums";

export class ImportCompanyAccountPlanDto {
  @IsUUID()
  storedFileId!: string;

  @IsString()
  @MaxLength(255)
  name!: string;
}

export class ListCompanyAccountsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsEnum(CompanyAccountMappingStatus)
  mappingStatus?: CompanyAccountMappingStatus;

  @IsOptional()
  @IsEnum(CompanyAccountMappingMethod)
  mappingMethod?: CompanyAccountMappingMethod;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class AssignCompanyAccountMappingDto {
  @IsUUID()
  siiAccountId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ReviewCompanyAccountMappingDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value ?? undefined)
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { CompanyAccountMappingStatus } from "../../company-account-plan/enums/company-account-plan.enums";

export class ListPeriodAccountMappingsDto {
  @IsOptional()
  @IsEnum(CompanyAccountMappingStatus)
  status?: CompanyAccountMappingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  newInPeriod?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  nameChanged?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  usedInPeriod?: boolean;

  @IsOptional()
  @IsUUID()
  documentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdatePeriodAccountMappingDto {
  @IsIn(["confirm", "reject"])
  action!: "confirm" | "reject";

  @ValidateIf((dto: UpdatePeriodAccountMappingDto) => dto.action === "confirm")
  @IsUUID()
  siiAccountId?: string;
}

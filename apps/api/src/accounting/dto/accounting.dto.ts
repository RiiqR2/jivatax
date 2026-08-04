import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  Length,
  Max,
  Min,
} from "class-validator";
import {
  BalanceRole,
  TaxDocumentType,
  TaxPeriodStatus,
} from "../enums/accounting.enums";

export class CreateTaxPeriodDto {
  @IsInt() @Min(1900) @Max(2200) commercialYear!: number;
  @IsInt() @Min(1900) @Max(2201) taxYear!: number;
  @IsString() startDate!: string;
  @IsString() endDate!: string;
  @IsOptional() @IsString() taxRegime?: string;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsString() exceptionReason?: string;
}

export class UpdateTaxPeriodDto {
  @IsOptional() @IsEnum(TaxPeriodStatus) status?: TaxPeriodStatus;
  @IsOptional() @IsString() taxRegime?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateTaxDocumentDto {
  @IsEnum(TaxDocumentType) documentType!: TaxDocumentType;
  @ValidateIf(
    (value: CreateTaxDocumentDto) =>
      value.documentType === TaxDocumentType.BALANCE ||
      value.balanceRole !== undefined,
  )
  @IsEnum(BalanceRole)
  balanceRole?: BalanceRole;
  @IsUUID() storedFileId!: string;
  @ValidateIf(
    (value: CreateTaxDocumentDto) =>
      value.documentType === TaxDocumentType.BALANCE &&
      value.balanceRole === BalanceRole.CLOSING,
  )
  @IsString()
  cutoffDate?: string;
}

export class ProcessTaxDocumentDto {
  @IsOptional() @IsString() sheetName?: string;
}

export class DiscardTaxDocumentDto {
  @IsString() @Length(3, 1000) reason!: string;
}

export class ClassifyHistoricalBalanceDto {
  @IsEnum(BalanceRole) balanceRole!: BalanceRole;
}

export class ListTaxDocumentsQueryDto {
  @IsOptional()
  @IsEnum(TaxDocumentType)
  documentType?: TaxDocumentType;
}

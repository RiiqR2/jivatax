import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from "class-validator";
import { TaxDocumentType, TaxPeriodStatus } from "../enums/accounting.enums";

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
  @IsUUID() storedFileId!: string;
}

export class ProcessTaxDocumentDto {
  @IsOptional() @IsString() sheetName?: string;
}

export class ListTaxDocumentsQueryDto {
  @IsOptional()
  @IsEnum(TaxDocumentType)
  documentType?: TaxDocumentType;
}

import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
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
export class ListPeriodAccountMappingsDto {
  @IsOptional()
  @IsIn([
    "pending",
    "suggested",
    "withoutSuggestion",
    "confirmed",
    "rejected",
    "unmapped",
  ])
  status?:
    | "pending"
    | "suggested"
    | "withoutSuggestion"
    | "confirmed"
    | "rejected"
    | "unmapped";

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

export class ApproveAccountSuggestionsBatchDto {
  @IsArray()
  @IsUUID("4", { each: true })
  companyAccountIds!: string[];

  /** When true, REVIEW suggestions may be approved via explicit manual batch. */
  allowReview?: boolean;
}

export class UpdatePeriodAccountMappingDto {
  @IsIn(["confirm", "reject"])
  action!: "confirm" | "reject";

  @ValidateIf((dto: UpdatePeriodAccountMappingDto) => dto.action === "confirm")
  @IsUUID()
  siiAccountId?: string;
}

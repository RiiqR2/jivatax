import { Transform, Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export class ExplorerPaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

export class BalanceExplorerQueryDto extends ExplorerPaginationDto {
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID()
  balanceDocumentId?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() search?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() code?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(["all", "mapped", "pending"]) mapping = "all";
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsIn(["asset", "liability", "loss", "gain"])
  section?: string;
  @IsOptional()
  @IsIn([
    "code",
    "name",
    "debit",
    "credit",
    "difference",
    "movements",
    "lastMovement",
  ])
  sort = "code";
  @IsOptional()
  @IsIn(["all", "reconciled", "difference", "no_ledger", "unavailable"])
  reconciliation?: string = "all";
  @IsOptional() @IsIn(["asc", "desc"]) direction = "asc";
}

export class GeneralLedgerQueryDto extends ExplorerPaginationDto {
  @Transform(emptyToUndefined) @IsOptional() @IsString() from?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() to?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() documentType?: string;
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  documentNumber?: string;
  @Transform(emptyToUndefined) @IsOptional() @IsString() search?: string;
  @IsOptional()
  @IsIn([
    "date",
    "documentType",
    "documentNumber",
    "description",
    "debit",
    "credit",
    "runningBalance",
  ])
  sort = "date";
  @IsOptional()
  @Transform(({ value }) => String(value).toLowerCase())
  @IsIn(["asc", "desc"])
  direction = "asc";
}

export class OpeningControlQueryDto extends ExplorerPaginationDto {
  @Transform(emptyToUndefined) @IsOptional() @IsString() search?: string;
  @IsOptional()
  @IsIn([
    "matching",
    "difference",
    "only_in_opening",
    "only_in_previous_closing",
  ])
  status?: string;
  @IsOptional()
  @IsIn(["code", "debitDifference", "creditDifference", "status"])
  sort = "code";
  @IsOptional() @IsIn(["asc", "desc"]) direction = "asc";
}

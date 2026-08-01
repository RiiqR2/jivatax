import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ExplorerPaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 25;
}

export class BalanceExplorerQueryDto extends ExplorerPaginationDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(["all", "mapped", "pending"]) mapping = "all";
  @IsOptional() @IsIn(["asset", "liability", "loss", "gain"]) section?: string;
  @IsOptional() @IsIn(["code", "name", "debit", "credit"]) sort = "code";
  @IsOptional() @IsIn(["asc", "desc"]) direction = "asc";
}

export class GeneralLedgerQueryDto extends ExplorerPaginationDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsString() documentNumber?: string;
  @IsOptional() @IsString() search?: string;
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

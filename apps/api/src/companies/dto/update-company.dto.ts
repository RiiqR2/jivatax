import { Transform } from "class-transformer";
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from "class-validator";
import { CompanyStatus } from "../enums/company-status.enum";
import { IsChileanRut } from "../validators/is-chilean-rut.validator";

export class UpdateCompanyDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 255)
  legalName?: string;
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" && value.trim() === ""
      ? null
      : typeof value === "string"
        ? value.trim()
        : value,
  )
  @IsString()
  @MaxLength(255)
  tradeName?: string | null;
  @IsOptional()
  @IsString()
  @IsChileanRut({ message: "El RUT no es válido." })
  taxId?: string;
  @IsOptional() @IsEnum(CompanyStatus) status?: CompanyStatus;
}

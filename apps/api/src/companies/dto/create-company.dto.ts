import { Transform } from "class-transformer";
import { IsOptional, IsString, Length, MaxLength } from "class-validator";
import { IsChileanRut } from "../validators/is-chilean-rut.validator";

export class CreateCompanyDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(2, 255)
  legalName!: string;

  @Transform(({ value }) =>
    typeof value === "string" && value.trim() === ""
      ? null
      : typeof value === "string"
        ? value.trim()
        : value,
  )
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tradeName?: string | null;

  @IsString() @IsChileanRut({ message: "El RUT no es válido." }) taxId!: string;
}

import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from "class-validator";
import { A17_INPUT } from "../calculators/a17-v1.calculator";
export class CreateWorkPaperExecutionDto {
  @IsUUID() definitionId!: string;
  @IsOptional() @IsUUID() supersedesExecutionId?: string;
}
export class A17ManualInputDto {
  @IsIn(Object.values(A17_INPUT)) inputKey!: string;
  @IsString() @Matches(/^-?\d+(\.\d{1,4})?$/) value!: string;
  @IsOptional() @IsString() description?: string;
}
export class CalculateA17Dto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => A17ManualInputDto)
  manualInputs: A17ManualInputDto[] = [];
}

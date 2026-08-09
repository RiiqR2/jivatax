import { IsOptional, IsUUID } from "class-validator";
export class CreateWorkPaperExecutionDto {
  @IsUUID() definitionId!: string;
  @IsOptional() @IsUUID() supersedesExecutionId?: string;
}

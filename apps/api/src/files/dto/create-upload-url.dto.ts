import { IsMimeType, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateUploadUrlDto {
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @IsMimeType()
  contentType!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}

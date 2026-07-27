import {
  IsEnum,
  IsMimeType,
  NotContains,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { StoredFileCategory } from '../entities/stored-file.entity';

export class FileMetadataDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @NotContains('/')
  @NotContains('\\')
  originalName!: string;

  @IsString()
  @IsMimeType()
  @MaxLength(255)
  contentType!: string;

  @IsString()
  @Matches(/^\d+$/, { message: 'sizeBytes must be a non-negative integer string' })
  @Length(1, 20)
  sizeBytes!: string;

  @IsEnum(StoredFileCategory)
  category!: StoredFileCategory;
}

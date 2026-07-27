import { IsEnum, IsOptional } from 'class-validator';
import {
  StoredFileCategory,
  StoredFileDirection,
  StoredFileStatus,
} from '../entities/stored-file.entity';

export class ListFilesQueryDto {
  @IsOptional()
  @IsEnum(StoredFileCategory)
  category?: StoredFileCategory;

  @IsOptional()
  @IsEnum(StoredFileDirection)
  direction?: StoredFileDirection;

  @IsOptional()
  @IsEnum(StoredFileStatus)
  status?: StoredFileStatus;
}

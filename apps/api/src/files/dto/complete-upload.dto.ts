import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { FileMetadataDto } from './file-metadata.dto';

export class CompleteUploadDto extends FileMetadataDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  objectKey!: string;
}

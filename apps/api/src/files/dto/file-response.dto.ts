import {
  StoredFileCategory,
  StoredFileDirection,
  StoredFileStatus,
} from '../entities/stored-file.entity';

export interface FileResponseDto {
  id: string;
  originalName: string;
  extension: string;
  contentType: string;
  sizeBytes: string;
  category: StoredFileCategory;
  direction: StoredFileDirection;
  status: StoredFileStatus;
  createdAt: Date;
}

export interface UploadUrlResponseDto {
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
}

export interface DownloadUrlResponseDto {
  downloadUrl: string;
  expiresIn: number;
}

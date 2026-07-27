export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');

export interface CreateUploadUrlOptions {
  bucket: string;
  objectKey: string;
  contentType: string;
  expiresIn: number;
}

export interface CreateDownloadUrlOptions {
  bucket: string;
  objectKey: string;
  downloadName: string;
  expiresIn: number;
}

export interface ObjectStorageService {
  createUploadUrl(options: CreateUploadUrlOptions): Promise<string>;
  createDownloadUrl(options: CreateDownloadUrlOptions): Promise<string>;
  objectExists(bucket: string, objectKey: string): Promise<boolean>;
}

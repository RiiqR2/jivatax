import {
  GetObjectCommand,
  HeadObjectCommand,
  NotFound,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  CreateDownloadUrlOptions,
  CreateUploadUrlOptions,
  ObjectStorageService,
} from './object-storage.service';

@Injectable()
export class S3ObjectStorageService implements ObjectStorageService {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigService) {
    const accessKeyId = this.config.get<string>('storage.accessKey');
    const secretAccessKey = this.config.get<string>('storage.secretKey');

    this.client = new S3Client({
      endpoint: this.config.get<string>('storage.endpoint'),
      region: this.config.getOrThrow<string>('storage.region'),
      forcePathStyle: this.config.get<boolean>('storage.forcePathStyle', true),
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  createUploadUrl(options: CreateUploadUrlOptions): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: options.bucket,
      Key: options.objectKey,
      ContentType: options.contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: options.expiresIn });
  }

  createDownloadUrl(options: CreateDownloadUrlOptions): Promise<string> {
    const safeName = options.downloadName.replace(/["\r\n]/g, '_');
    const command = new GetObjectCommand({
      Bucket: options.bucket,
      Key: options.objectKey,
      ResponseContentDisposition: `attachment; filename="${safeName}"`,
    });
    return getSignedUrl(this.client, command, { expiresIn: options.expiresIn });
  }

  async objectExists(bucket: string, objectKey: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
      return true;
    } catch (error: unknown) {
      if (
        error instanceof NotFound ||
        (typeof error === 'object' && error !== null && '$metadata' in error &&
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
      ) {
        return false;
      }
      throw error;
    }
  }
}

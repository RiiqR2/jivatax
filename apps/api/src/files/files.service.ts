import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { StoredFileEntity } from '../database/entities/stored-file.entity';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';

@Injectable()
export class FilesService {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(StoredFileEntity)
    private readonly filesRepository: Repository<StoredFileEntity>,
  ) {
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
    this.client = new S3Client({
      endpoint: this.config.get<string>('S3_ENDPOINT'),
      region: this.config.get('S3_REGION', 'us-east-1'),
      forcePathStyle: this.config.get('S3_FORCE_PATH_STYLE', 'false') === 'true',
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
  }

  async createUploadUrl(dto: CreateUploadUrlDto) {
    const safeName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `${dto.companyId ?? 'unassigned'}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: dto.contentType,
    });

    return {
      objectKey,
      uploadUrl: await getSignedUrl(this.client, command, { expiresIn: 15 * 60 }),
      expiresInSeconds: 15 * 60,
    };
  }

  async registerUploadedFile(input: {
    objectKey: string;
    originalName: string;
    contentType: string;
    sizeBytes: number;
    companyId?: string;
  }) {
    return this.filesRepository.save(
      this.filesRepository.create({
        bucket: this.bucket,
        objectKey: input.objectKey,
        originalName: input.originalName,
        contentType: input.contentType,
        sizeBytes: String(input.sizeBytes),
        companyId: input.companyId ?? null,
      }),
    );
  }

  async createDownloadUrl(fileId: string) {
    const file = await this.filesRepository.findOneBy({ id: fileId });
    if (!file) throw new NotFoundException('Archivo no encontrado');

    const command = new GetObjectCommand({
      Bucket: file.bucket,
      Key: file.objectKey,
      ResponseContentDisposition: `attachment; filename="${file.originalName.replace(/"/g, '')}"`,
    });

    return {
      downloadUrl: await getSignedUrl(this.client, command, { expiresIn: 5 * 60 }),
      expiresInSeconds: 5 * 60,
    };
  }
}

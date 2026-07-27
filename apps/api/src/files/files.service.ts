import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { CompaniesService } from '../companies/companies.service';
import { CompleteUploadDto } from './dto/complete-upload.dto';
import { CreateUploadUrlDto } from './dto/create-upload-url.dto';
import {
  DownloadUrlResponseDto,
  FileResponseDto,
  UploadUrlResponseDto,
} from './dto/file-response.dto';
import { FileMetadataDto } from './dto/file-metadata.dto';
import { ListFilesQueryDto } from './dto/list-files-query.dto';
import {
  StoredFileDirection,
  StoredFileEntity,
  StoredFileStatus,
} from './entities/stored-file.entity';
import {
  OBJECT_STORAGE,
  ObjectStorageService,
} from './storage/object-storage.service';

@Injectable()
export class FilesService {
  constructor(
    @InjectRepository(StoredFileEntity)
    private readonly storedFilesRepository: Repository<StoredFileEntity>,
    private readonly companiesService: CompaniesService,
    private readonly config: ConfigService,
    @Inject(OBJECT_STORAGE)
    private readonly storage: ObjectStorageService,
  ) {}

  async createUploadUrl(
    companyId: string,
    dto: CreateUploadUrlDto,
  ): Promise<UploadUrlResponseDto> {
    await this.assertCompanyAccess(companyId);
    this.validateMetadata(dto);

    const extension = this.getExtension(dto.originalName);
    const suffix = extension ? `.${extension}` : '';
    const objectKey = `companies/${companyId}/input/${randomUUID()}${suffix}`;
    const bucket = this.getBucket();
    const expiresIn = this.getSignedUrlExpiration();
    const uploadUrl = await this.storage.createUploadUrl({
      bucket,
      objectKey,
      contentType: dto.contentType,
      expiresIn,
    });

    return { objectKey, uploadUrl, expiresIn };
  }

  async completeUpload(
    companyId: string,
    dto: CompleteUploadDto,
  ): Promise<FileResponseDto> {
    await this.assertCompanyAccess(companyId);
    this.validateMetadata(dto);
    this.assertOwnedObjectKey(companyId, dto.objectKey);

    const bucket = this.getBucket();
    if (await this.storedFilesRepository.existsBy({ bucket, objectKey: dto.objectKey })) {
      throw new ConflictException('The storage object is already registered');
    }
    if (!(await this.storage.objectExists(bucket, dto.objectKey))) {
      throw new BadRequestException('The uploaded object does not exist in storage');
    }

    const storedFile = this.storedFilesRepository.create({
      companyId,
      bucket,
      objectKey: dto.objectKey,
      originalName: dto.originalName,
      extension: this.getExtension(dto.originalName),
      contentType: dto.contentType,
      sizeBytes: dto.sizeBytes,
      category: dto.category,
      direction: StoredFileDirection.INPUT,
      status: StoredFileStatus.UPLOADED,
    });

    try {
      return this.toResponse(await this.storedFilesRepository.save(storedFile));
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('The storage object is already registered');
      }
      throw error;
    }
  }

  async list(companyId: string, query: ListFilesQueryDto): Promise<FileResponseDto[]> {
    await this.assertCompanyAccess(companyId);
    const where: FindOptionsWhere<StoredFileEntity> = { companyId };
    if (query.category !== undefined) where.category = query.category;
    if (query.direction !== undefined) where.direction = query.direction;
    if (query.status !== undefined) where.status = query.status;

    const files = await this.storedFilesRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return files.map((file) => this.toResponse(file));
  }

  async createDownloadUrl(
    companyId: string,
    fileId: string,
  ): Promise<DownloadUrlResponseDto> {
    await this.assertCompanyAccess(companyId);
    const file = await this.storedFilesRepository.findOneBy({ id: fileId, companyId });
    if (!file) throw new NotFoundException('File not found');

    const expiresIn = this.getSignedUrlExpiration();
    const downloadUrl = await this.storage.createDownloadUrl({
      bucket: file.bucket,
      objectKey: file.objectKey,
      downloadName: file.originalName,
      expiresIn,
    });
    return { downloadUrl, expiresIn };
  }

  private async assertCompanyAccess(companyId: string): Promise<void> {
    const companyExists = await this.companiesService.companiesRepository.existsBy({ id: companyId });
    if (!companyExists) throw new NotFoundException('Company not found');

    // TODO(auth): validate that the authenticated user belongs to this company's organization.
  }

  private validateMetadata(dto: FileMetadataDto): void {
    let size: bigint;
    try {
      size = BigInt(dto.sizeBytes);
    } catch {
      throw new BadRequestException('sizeBytes must be a non-negative integer string');
    }
    if (size < 0n) throw new BadRequestException('sizeBytes must not be negative');
    if (size > this.getMaxFileSize()) {
      throw new PayloadTooLargeException('File exceeds the configured maximum size');
    }
    this.getExtension(dto.originalName);
  }

  private getExtension(originalName: string): string {
    const extension = extname(originalName).slice(1).toLowerCase();
    if (extension.length > 20) {
      throw new BadRequestException('File extension must not exceed 20 characters');
    }
    return extension;
  }

  private assertOwnedObjectKey(companyId: string, objectKey: string): void {
    if (!objectKey.startsWith(`companies/${companyId}/input/`)) {
      throw new BadRequestException('objectKey is not valid for this company');
    }
  }

  private getBucket(): string {
    return this.config.getOrThrow<string>('storage.bucket');
  }

  private getSignedUrlExpiration(): number {
    const value = this.config.getOrThrow<number>('storage.signedUrlExpiresIn');
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('S3_SIGNED_URL_EXPIRES_IN must be a positive integer');
    }
    return value;
  }

  private getMaxFileSize(): bigint {
    const configured = this.config.getOrThrow<string>('storage.maxFileSizeBytes');
    try {
      const value = BigInt(configured);
      if (value <= 0n) throw new Error();
      return value;
    } catch {
      throw new Error('FILE_MAX_SIZE_BYTES must be a positive integer');
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return typeof error === 'object' && error !== null &&
      ('code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY' ||
        'errno' in error && (error as { errno?: number }).errno === 1062);
  }

  private toResponse(file: StoredFileEntity): FileResponseDto {
    return {
      id: file.id,
      originalName: file.originalName,
      extension: file.extension,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      category: file.category,
      direction: file.direction,
      status: file.status,
      createdAt: file.createdAt,
    };
  }
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { CompaniesService } from '../companies/companies.service';
import { StoredFileCategory, StoredFileDirection, StoredFileEntity, StoredFileStatus } from './entities/stored-file.entity';
import { FilesService } from './files.service';
import { ObjectStorageService } from './storage/object-storage.service';

interface Harness {
  service: FilesService;
  repository: {
    existsBy: (where: Partial<StoredFileEntity>) => Promise<boolean>;
    create: (data: Partial<StoredFileEntity>) => StoredFileEntity;
    save: (file: StoredFileEntity) => Promise<StoredFileEntity>;
    find: (options: unknown) => Promise<StoredFileEntity[]>;
    findOneBy: (where: Partial<StoredFileEntity>) => Promise<StoredFileEntity | null>;
  };
  storage: ObjectStorageService;
  saved: StoredFileEntity[];
  downloadCalls: Array<Record<string, unknown>>;
}

function harness(options: { companyExists?: boolean; objectExists?: boolean; duplicate?: boolean; maxSize?: string } = {}): Harness {
  const saved: StoredFileEntity[] = [];
  const downloadCalls: Array<Record<string, unknown>> = [];
  const repository = {
    existsBy: async () => options.duplicate ?? false,
    create: (data: Partial<StoredFileEntity>) => Object.assign(new StoredFileEntity(), data),
    save: async (file: StoredFileEntity) => {
      Object.assign(file, { id: 'file-id', createdAt: new Date('2026-01-01T00:00:00Z') });
      saved.push(file);
      return file;
    },
    find: async () => saved,
    findOneBy: async () => saved[0] ?? null,
  };
  const companies = {
    companiesRepository: { existsBy: async () => options.companyExists ?? true },
  } as unknown as CompaniesService;
  const config = {
    getOrThrow: (key: string) => ({
      'storage.bucket': 'private-bucket',
      'storage.signedUrlExpiresIn': 900,
      'storage.maxFileSizeBytes': options.maxSize ?? '1000',
    })[key],
  } as ConfigService;
  const storage: ObjectStorageService = {
    createUploadUrl: async () => 'https://storage/upload',
    objectExists: async () => options.objectExists ?? true,
    createDownloadUrl: async (call) => {
      downloadCalls.push(call as unknown as Record<string, unknown>);
      return 'https://storage/download';
    },
  };
  const service = new FilesService(
    repository as unknown as Repository<StoredFileEntity>,
    companies,
    config,
    storage,
  );
  return { service, repository, storage, saved, downloadCalls };
}

const metadata = {
  originalName: 'balance-2025.xlsx',
  contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  sizeBytes: '500',
  category: StoredFileCategory.BALANCE,
};
const companyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('FilesService', () => {
  it('creates a company-scoped signed upload URL without exposing the bucket', async () => {
    const { service } = harness();
    const result = await service.createUploadUrl(companyId, metadata);
    assert.match(result.objectKey, new RegExp(`^companies/${companyId}/input/.+\\.xlsx$`));
    assert.equal(result.uploadUrl, 'https://storage/upload');
    assert.equal(result.expiresIn, 900);
    assert.equal('bucket' in result, false);
  });

  it('rejects files over the configured maximum size', async () => {
    const { service } = harness({ maxSize: '499' });
    await assert.rejects(() => service.createUploadUrl(companyId, metadata), PayloadTooLargeException);
  });

  it('registers only trusted input/uploaded metadata after checking storage', async () => {
    const { service, saved } = harness();
    const objectKey = `companies/${companyId}/input/upload.xlsx`;
    const result = await service.completeUpload(companyId, { ...metadata, objectKey });
    assert.equal(saved[0].bucket, 'private-bucket');
    assert.equal(saved[0].extension, 'xlsx');
    assert.equal(saved[0].direction, StoredFileDirection.INPUT);
    assert.equal(saved[0].status, StoredFileStatus.UPLOADED);
    assert.equal('bucket' in result, false);
    assert.equal('objectKey' in result, false);
  });

  it('rejects an object key already registered', async () => {
    const { service } = harness({ duplicate: true });
    await assert.rejects(
      () => service.completeUpload(companyId, { ...metadata, objectKey: `companies/${companyId}/input/upload.xlsx` }),
      ConflictException,
    );
  });

  it('does not list files for a missing company', async () => {
    const { service } = harness({ companyExists: false });
    await assert.rejects(() => service.list(companyId, {}), NotFoundException);
  });

  it('downloads only a file selected by company and suggests its original name', async () => {
    const { service, saved, downloadCalls } = harness();
    saved.push(Object.assign(new StoredFileEntity(), {
      id: 'file-id', companyId, bucket: 'private-bucket', objectKey: 'private/key',
      originalName: metadata.originalName, extension: 'xlsx', contentType: metadata.contentType,
      sizeBytes: metadata.sizeBytes, category: metadata.category,
      direction: StoredFileDirection.INPUT, status: StoredFileStatus.UPLOADED,
      createdAt: new Date(),
    }));
    const result = await service.createDownloadUrl(companyId, 'file-id');
    assert.deepEqual(result, { downloadUrl: 'https://storage/download', expiresIn: 900 });
    assert.equal(downloadCalls[0].downloadName, metadata.originalName);
  });
});

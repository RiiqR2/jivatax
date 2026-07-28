import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { storageConfig } from "../../config/storage.config";
import { OBJECT_STORAGE } from "./object-storage.service";
import { S3ObjectStorageService } from "./s3-object-storage.service";

@Module({
  imports: [ConfigModule.forFeature(storageConfig)],
  providers: [
    S3ObjectStorageService,
    { provide: OBJECT_STORAGE, useExisting: S3ObjectStorageService },
  ],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}

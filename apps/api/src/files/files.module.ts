import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { storageConfig } from '../config/storage.config';
import { StoredFileEntity } from './entities/stored-file.entity';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StoredFileEntity]),
    CompaniesModule,
    ConfigModule.forFeature(storageConfig),
    StorageModule,
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

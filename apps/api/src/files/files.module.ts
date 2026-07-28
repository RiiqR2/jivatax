import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesModule } from '../companies/companies.module';
import { storageConfig } from '../config/storage.config';
import { StoredFileEntity } from './entities/stored-file.entity';
import { CompanyAccessGuard } from '../auth/guards/company-access.guard';
import { CompanyEntity } from '../companies/entities/company.entity';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StoredFileEntity, CompanyEntity]),
    CompaniesModule,
    ConfigModule.forFeature(storageConfig),
    StorageModule,
  ],
  controllers: [FilesController],
  providers: [CompanyAccessGuard, FilesService],
  exports: [FilesService],
})
export class FilesModule {}

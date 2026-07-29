import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { CompaniesModule } from "../companies/companies.module";
import { CompanyEntity } from "../companies/entities/company.entity";
import { storageConfig } from "../config/storage.config";
import { StoredFileEntity } from "./entities/stored-file.entity";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";
import { StorageModule } from "./storage/storage.module";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([StoredFileEntity, CompanyEntity, OrganizationMemberEntity]),
    CompaniesModule,
    ConfigModule.forFeature(storageConfig),
    StorageModule,
    AuthModule,
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}

import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { CompanyEntity } from "../companies/entities/company.entity";
import { StoredFileEntity } from "../files/entities/stored-file.entity";
import { StorageModule } from "../files/storage/storage.module";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import { DocumentTemplatesController } from "./controllers/document-templates.controller";
import { TaxDocumentsController } from "./controllers/tax-documents.controller";
import { TaxPeriodsController } from "./controllers/tax-periods.controller";
import { TaxDocumentEntity } from "./entities/tax-document.entity";
import { TaxPeriodEntity } from "./entities/tax-period.entity";
import { DocumentTemplateService } from "./services/document-template.service";
import { TaxDocumentsService } from "./services/tax-documents.service";
import { TaxPeriodsService } from "./services/tax-periods.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxPeriodEntity,
      TaxDocumentEntity,
      StoredFileEntity,
      CompanyEntity,
      OrganizationMemberEntity,
    ]),
    AuthModule,
    StorageModule,
  ],
  controllers: [
    TaxPeriodsController,
    TaxDocumentsController,
    DocumentTemplatesController,
  ],
  providers: [TaxPeriodsService, TaxDocumentsService, DocumentTemplateService],
})
export class AccountingModule {}

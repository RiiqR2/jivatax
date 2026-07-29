import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { CompanyEntity } from "../companies/entities/company.entity";
import { StoredFileEntity } from "../files/entities/stored-file.entity";
import { StorageModule } from "../files/storage/storage.module";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import { UserEntity } from "../users/entities/user.entity";
import { DocumentTemplatesController } from "./controllers/document-templates.controller";
import { TaxDocumentsController } from "./controllers/tax-documents.controller";
import { TaxPeriodsController } from "./controllers/tax-periods.controller";
import { PeriodAccountMappingsController } from "./controllers/period-account-mappings.controller";
import { TaxDocumentEntity } from "./entities/tax-document.entity";
import { TaxPeriodEntity } from "./entities/tax-period.entity";
import { DocumentTemplateService } from "./services/document-template.service";
import { TaxDocumentsService } from "./services/tax-documents.service";
import { TaxPeriodsService } from "./services/tax-periods.service";
import { PeriodAccountMappingsService } from "./services/period-account-mappings.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxPeriodEntity,
      TaxDocumentEntity,
      StoredFileEntity,
      CompanyEntity,
      OrganizationMemberEntity,
      UserEntity,
    ]),
    AuthModule,
    StorageModule,
  ],
  controllers: [
    TaxPeriodsController,
    TaxDocumentsController,
    DocumentTemplatesController,
    PeriodAccountMappingsController,
  ],
  providers: [
    TaxPeriodsService,
    TaxDocumentsService,
    DocumentTemplateService,
    PeriodAccountMappingsService,
  ],
})
export class AccountingModule {}

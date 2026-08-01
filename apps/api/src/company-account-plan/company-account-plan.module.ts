import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { CompanyEntity } from "../companies/entities/company.entity";
import { StoredFileEntity } from "../files/entities/stored-file.entity";
import { StorageModule } from "../files/storage/storage.module";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import { SiiAccountPlanVersionEntity } from "../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountEntity } from "../sii-account-plan/entities/sii-account.entity";
import { CompanyAccountPlanController } from "./company-account-plan.controller";
import { CompanyAccountMappingEntity } from "./entities/company-account-mapping.entity";
import { CompanyAccountPlanVersionEntity } from "./entities/company-account-plan-version.entity";
import { CompanyAccountEntity } from "./entities/company-account.entity";
import { CompanyAccountMatchingService } from "./services/company-account-matching.service";
import { CompanyAccountPlanParserService } from "./services/company-account-plan-parser.service";
import { CompanyAccountPlanService } from "./services/company-account-plan.service";
import { CompanyAccountPlanTemplateService } from "./services/company-account-plan-template.service";
import { SiiAccountPlanModule } from "../sii-account-plan/sii-account-plan.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CompanyAccountPlanVersionEntity,
      CompanyAccountEntity,
      CompanyAccountMappingEntity,
      CompanyEntity,
      OrganizationMemberEntity,
      StoredFileEntity,
      SiiAccountPlanVersionEntity,
      SiiAccountEntity,
    ]),
    AuthModule,
    StorageModule,
    SiiAccountPlanModule,
  ],
  controllers: [CompanyAccountPlanController],
  providers: [
    CompanyAccountPlanService,
    CompanyAccountPlanParserService,
    CompanyAccountPlanTemplateService,
    CompanyAccountMatchingService,
  ],
})
export class CompanyAccountPlanModule {}

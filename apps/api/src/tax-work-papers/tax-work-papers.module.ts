import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaxPeriodEntity } from "../accounting/entities/tax-period.entity";
import { AuthModule } from "../auth/auth.module";
import { CompanyEntity } from "../companies/entities/company.entity";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import { TaxAdjustmentEntity } from "./entities/tax-adjustment.entity";
import { WorkPaperApplicabilityEntity } from "./entities/work-paper-applicability.entity";
import { WorkPaperDefinitionEntity } from "./entities/work-paper-definition.entity";
import { WorkPaperDependencyEntity } from "./entities/work-paper-dependency.entity";
import { WorkPaperEvidenceEntity } from "./entities/work-paper-evidence.entity";
import { WorkPaperExecutionEntity } from "./entities/work-paper-execution.entity";
import { WorkPaperInputEntity } from "./entities/work-paper-input.entity";
import { WorkPaperJobEntity } from "./entities/work-paper-job.entity";
import {
  TaxWorkPapersController,
  WorkPaperDefinitionsController,
} from "./tax-work-papers.controller";
import { TaxWorkPapersService } from "./tax-work-papers.service";
import { A17V1Calculator } from "./calculators/a17-v1.calculator";
import { CuratedApplicabilitySyncService } from "./services/curated-applicability-sync.service";
import { WorkPaperJobProcessor } from "./services/work-paper-job.processor";
import { WorkPaperJobService } from "./services/work-paper-job.service";
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxPeriodEntity,
      CompanyEntity,
      OrganizationMemberEntity,
      WorkPaperDefinitionEntity,
      WorkPaperApplicabilityEntity,
      WorkPaperExecutionEntity,
      WorkPaperInputEntity,
      WorkPaperEvidenceEntity,
      WorkPaperDependencyEntity,
      TaxAdjustmentEntity,
      WorkPaperJobEntity,
    ]),
    AuthModule,
  ],
  controllers: [WorkPaperDefinitionsController, TaxWorkPapersController],
  providers: [
    TaxWorkPapersService,
    A17V1Calculator,
    CuratedApplicabilitySyncService,
    WorkPaperJobService,
    WorkPaperJobProcessor,
  ],
  exports: [TaxWorkPapersService, CuratedApplicabilitySyncService],
})
export class TaxWorkPapersModule {}

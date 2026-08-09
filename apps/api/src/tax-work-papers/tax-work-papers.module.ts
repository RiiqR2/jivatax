import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TaxPeriodEntity } from "../accounting/entities/tax-period.entity";
import { AuthModule } from "../auth/auth.module";
import { TaxAdjustmentEntity } from "./entities/tax-adjustment.entity";
import { WorkPaperApplicabilityEntity } from "./entities/work-paper-applicability.entity";
import { WorkPaperDefinitionEntity } from "./entities/work-paper-definition.entity";
import { WorkPaperDependencyEntity } from "./entities/work-paper-dependency.entity";
import { WorkPaperEvidenceEntity } from "./entities/work-paper-evidence.entity";
import { WorkPaperExecutionEntity } from "./entities/work-paper-execution.entity";
import { WorkPaperInputEntity } from "./entities/work-paper-input.entity";
import {
  TaxWorkPapersController,
  WorkPaperDefinitionsController,
} from "./tax-work-papers.controller";
import { TaxWorkPapersService } from "./tax-work-papers.service";
import { A17V1Calculator } from "./calculators/a17-v1.calculator";
@Module({
  imports: [
    TypeOrmModule.forFeature([
      TaxPeriodEntity,
      WorkPaperDefinitionEntity,
      WorkPaperApplicabilityEntity,
      WorkPaperExecutionEntity,
      WorkPaperInputEntity,
      WorkPaperEvidenceEntity,
      WorkPaperDependencyEntity,
      TaxAdjustmentEntity,
    ]),
    AuthModule,
  ],
  controllers: [WorkPaperDefinitionsController, TaxWorkPapersController],
  providers: [TaxWorkPapersService, A17V1Calculator],
  exports: [TaxWorkPapersService],
})
export class TaxWorkPapersModule {}

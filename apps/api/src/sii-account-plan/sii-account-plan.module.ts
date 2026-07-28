import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SiiAccountPlanController } from "./controllers/sii-account-plan.controller";
import { SiiAccountEntity } from "./entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "./entities/sii-account-plan-version.entity";
import { SiiAccountPlanImportService } from "./services/sii-account-plan-import.service";
import { SiiAccountPlanService } from "./services/sii-account-plan.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([SiiAccountPlanVersionEntity, SiiAccountEntity]),
  ],
  controllers: [SiiAccountPlanController],
  providers: [SiiAccountPlanService, SiiAccountPlanImportService],
  exports: [SiiAccountPlanImportService],
})
export class SiiAccountPlanModule {}

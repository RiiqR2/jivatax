import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NormalizationService } from "../common/services/normalization.service";
import { IndustryEntity } from "./entities/industry.entity";
import { IndustriesController } from "./industries.controller";
import { IndustriesService } from "./industries.service";

@Module({
  imports: [TypeOrmModule.forFeature([IndustryEntity])],
  controllers: [IndustriesController],
  providers: [IndustriesService, NormalizationService],
  exports: [IndustriesService, NormalizationService, TypeOrmModule],
})
export class IndustriesModule {}

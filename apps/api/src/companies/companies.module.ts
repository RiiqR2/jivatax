import { Module } from "@nestjs/common";
import { IndustriesModule } from "../industries/industries.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompaniesService } from "./companies.service";
import { CompaniesController } from "./companies.controller";
import { CompanyEntity } from "./entities/company.entity";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";

@Module({
  imports: [
    IndustriesModule,
    TypeOrmModule.forFeature([CompanyEntity, OrganizationMemberEntity]),
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}

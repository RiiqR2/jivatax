import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { CompanyEntity } from "../companies/entities/company.entity";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import { CompanyUsersController } from "./company-users.controller";
import { CompanyUsersService } from "./company-users.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([CompanyEntity, OrganizationMemberEntity]),
    AuthModule,
  ],
  controllers: [CompanyUsersController],
  providers: [CompanyUsersService],
})
export class CompanyUsersModule {}

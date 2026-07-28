import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompaniesModule } from "../companies/companies.module";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import { OrganizationEntity } from "../organizations/entities/organization.entity";
import { UserEntity } from "../users/entities/user.entity";
import { AdminCompaniesController } from "./companies/admin-companies.controller";
import { AdminCompaniesService } from "./companies/admin-companies.service";
import { MetaUserGuard } from "./guards/meta-user.guard";
import { AdminOrganizationsController } from "./organizations/admin-organizations.controller";
import { AdminOrganizationsService } from "./organizations/admin-organizations.service";
import { AdminUsersController } from "./users/admin-users.controller";
import { AdminUsersService } from "./users/admin-users.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      OrganizationEntity,
      OrganizationMemberEntity,
    ]),
    CompaniesModule,
  ],
  controllers: [
    AdminUsersController,
    AdminOrganizationsController,
    AdminCompaniesController,
  ],
  providers: [
    MetaUserGuard,
    AdminUsersService,
    AdminOrganizationsService,
    AdminCompaniesService,
  ],
})
export class AdminModule {}

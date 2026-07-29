import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AdminModule } from "./admin/admin.module";
import { AppController } from "./app.controller";
import { CompaniesModule } from "./companies/companies.module";
import { DatabaseModule } from "./database/database.module";
import { FilesModule } from "./files/files.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { UsersModule } from "./users/users.module";
import { AuthModule } from "./auth/auth.module";
import { SiiAccountPlanModule } from "./sii-account-plan/sii-account-plan.module";
import { CompanyAccountPlanModule } from "./company-account-plan/company-account-plan.module";
import { CompanyUsersModule } from "./company-users/company-users.module";
import { AccountingModule } from "./accounting/accounting.module";
import { SiiAccountMatchingModule } from "./sii-account-matching/sii-account-matching.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    DatabaseModule,
    AdminModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    CompaniesModule,
    FilesModule,
    SiiAccountPlanModule,
    CompanyAccountPlanModule,
    CompanyUsersModule,
    AccountingModule,
    SiiAccountMatchingModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

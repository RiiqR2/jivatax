import "reflect-metadata";
import { config as loadEnv } from "dotenv";
import { DataSource } from "typeorm";
import { CompanyEntity } from "../companies/entities/company.entity";
import { StoredFileEntity } from "../files/entities/stored-file.entity";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import { OrganizationEntity } from "../organizations/entities/organization.entity";
import { UserEntity } from "../users/entities/user.entity";
import { AuthSessionEntity } from "../auth/entities/auth-session.entity";
import { SiiAccountEntity } from "../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../sii-account-plan/entities/sii-account-plan-version.entity";
import { CompanyAccountPlanVersionEntity } from "../company-account-plan/entities/company-account-plan-version.entity";
import { CompanyAccountEntity } from "../company-account-plan/entities/company-account.entity";
import { CompanyAccountMappingEntity } from "../company-account-plan/entities/company-account-mapping.entity";
import { TaxDocumentEntity } from "../accounting/entities/tax-document.entity";
import { TaxPeriodEntity } from "../accounting/entities/tax-period.entity";
import { SiiAccountTermEntity } from "../sii-account-matching/entities/sii-account-term.entity";
import { TaxPeriodCompanyAccountEntity } from "../accounting/entities/tax-period-company-account.entity";
import { CompanyAccountSuggestionEntity } from "../accounting/entities/company-account-suggestion.entity";
import { CompanyAccountMappingHistoryEntity } from "../accounting/entities/company-account-mapping-history.entity";
import { AccountMatchingFeedbackEntity } from "../sii-account-matching/entities/account-matching-feedback.entity";

loadEnv({ path: "../../.env" });

export default new DataSource({
  type: "mysql",
  host: process.env.DATABASE_HOST ?? "localhost",
  port: Number(process.env.DATABASE_PORT ?? 3306),
  username: process.env.DATABASE_USER ?? "jivatax",
  password: process.env.DATABASE_PASSWORD ?? "jivatax",
  database: process.env.DATABASE_NAME ?? "jivatax",
  entities: [
    UserEntity,
    OrganizationEntity,
    OrganizationMemberEntity,
    CompanyEntity,
    StoredFileEntity,
    AuthSessionEntity,
    SiiAccountPlanVersionEntity,
    SiiAccountEntity,
    CompanyAccountPlanVersionEntity,
    CompanyAccountEntity,
    CompanyAccountMappingEntity,
    TaxPeriodEntity,
    TaxDocumentEntity,
    SiiAccountTermEntity,
    TaxPeriodCompanyAccountEntity,
    CompanyAccountSuggestionEntity,
    CompanyAccountMappingHistoryEntity,
    AccountMatchingFeedbackEntity,
  ],
  migrations: ["src/database/migrations/*.ts"],
  synchronize: false,
  logging: process.env.DATABASE_LOGGING === "true",
  charset: "utf8mb4",
  timezone: "Z",
});

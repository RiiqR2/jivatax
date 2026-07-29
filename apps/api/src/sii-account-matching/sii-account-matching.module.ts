import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompanyAccountSuggestionEntity } from "../accounting/entities/company-account-suggestion.entity";
import { SiiAccountEntity } from "../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountTermEntity } from "./entities/sii-account-term.entity";
import { SiiAccountTermsSyncService } from "./services/sii-account-terms-sync.service";
import { AccountSuggestionService } from "./services/account-suggestion.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SiiAccountEntity,
      SiiAccountPlanVersionEntity,
      SiiAccountTermEntity,
      CompanyAccountSuggestionEntity,
    ]),
  ],
  providers: [SiiAccountTermsSyncService, AccountSuggestionService],
  exports: [SiiAccountTermsSyncService, AccountSuggestionService],
})
export class SiiAccountMatchingModule {}

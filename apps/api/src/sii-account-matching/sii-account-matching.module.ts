import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CompanyAccountSuggestionEntity } from "../accounting/entities/company-account-suggestion.entity";
import { SiiAccountEntity } from "../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountTermEntity } from "./entities/sii-account-term.entity";
import { SiiAccountConceptEntity } from "./entities/sii-account-concept.entity";
import { SiiAccountConceptsSyncService } from "./services/sii-account-concepts-sync.service";
import { SiiAccountTermsSyncService } from "./services/sii-account-terms-sync.service";
import { AccountSuggestionService } from "./services/account-suggestion.service";
import { AccountAttributeParserService } from "./services/account-attribute-parser.service";
import { AccountCandidateGeneratorService } from "./services/account-candidate-generator.service";
import { AccountSuggestionRankingService } from "./services/account-suggestion-ranking.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SiiAccountEntity,
      SiiAccountPlanVersionEntity,
      SiiAccountTermEntity,
      SiiAccountConceptEntity,
      CompanyAccountSuggestionEntity,
    ]),
  ],
  providers: [
    SiiAccountTermsSyncService,
    SiiAccountConceptsSyncService,
    AccountAttributeParserService,
    AccountCandidateGeneratorService,
    AccountSuggestionRankingService,
    AccountSuggestionService,
  ],
  exports: [
    SiiAccountTermsSyncService,
    SiiAccountConceptsSyncService,
    AccountSuggestionService,
    AccountCandidateGeneratorService,
    AccountSuggestionRankingService,
  ],
})
export class SiiAccountMatchingModule {}

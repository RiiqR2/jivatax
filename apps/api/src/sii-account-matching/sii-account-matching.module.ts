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
import { SiiAccountKnowledgeEntity } from "./entities/sii-account-knowledge.entity";
import { AccountMatchingRuleEntity } from "./entities/account-matching-rule.entity";
import { AccountMatchingLearningEntity } from "./entities/account-matching-learning.entity";
import { AccountMatchingDiagnosticEntity } from "./entities/account-matching-diagnostic.entity";
import { AccountRuleEngineService } from "./rules/account-rule-engine.service";
import { AccountConfidenceCalibratorService } from "./calibration/account-confidence-calibrator.service";
import { SupervisedLearningService } from "./services/supervised-learning.service";
import { AccountMatchingCoverageService } from "./services/account-matching-coverage.service";
import { AccountMatchingDiagnosticsController } from "./controllers/account-matching-diagnostics.controller";
import { AccountKnowledgeService } from "./services/account-knowledge.service";
import { AccountMatchingFeedbackEntity } from "./entities/account-matching-feedback.entity";
import { CompanyEntity } from "../companies/entities/company.entity";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SiiAccountEntity,
      SiiAccountPlanVersionEntity,
      SiiAccountTermEntity,
      SiiAccountConceptEntity,
      CompanyAccountSuggestionEntity,
      SiiAccountKnowledgeEntity,
      AccountMatchingRuleEntity,
      AccountMatchingLearningEntity,
      AccountMatchingDiagnosticEntity,
      AccountMatchingFeedbackEntity,
      CompanyEntity,
      OrganizationMemberEntity,
    ]),
  ],
  providers: [
    SiiAccountTermsSyncService,
    SiiAccountConceptsSyncService,
    AccountAttributeParserService,
    AccountCandidateGeneratorService,
    AccountSuggestionRankingService,
    AccountSuggestionService,
    AccountRuleEngineService,
    AccountConfidenceCalibratorService,
    SupervisedLearningService,
    AccountMatchingCoverageService,
    AccountKnowledgeService,
  ],
  controllers: [AccountMatchingDiagnosticsController],
  exports: [
    SiiAccountTermsSyncService,
    SiiAccountConceptsSyncService,
    AccountSuggestionService,
    AccountCandidateGeneratorService,
    AccountSuggestionRankingService,
    SupervisedLearningService,
    AccountKnowledgeService,
  ],
})
export class SiiAccountMatchingModule {}

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
import { IndustriesModule } from "../industries/industries.module";
import { AccountMatchingConfirmationEntity } from "./entities/account-matching-confirmation.entity";
import { AccountMatchingLearningIndustryEntity } from "./entities/account-matching-learning-industry.entity";
import { AccountMatchingConfirmationService } from "./services/account-matching-confirmation.service";
import { LearningAggregatorService } from "./services/learning-aggregator.service";
import { ExpertAccountMappingImportService } from "./expert-import/expert-account-mapping-import.service";
import { SiiAccountPlanModule } from "../sii-account-plan/sii-account-plan.module";
import { MatchingResolutionContextFactoryService } from "./services/matching-resolution-context-factory.service";
import { SiiAccountMatchingV2EvaluationService } from "./services/sii-account-matching-v2-evaluation.service";
import { SiiAccountMatchingPipelineService } from "./pipeline/sii-account-matching-pipeline.service";
import { AccountObservationClassifierService } from "./pipeline/account-observation-classifier.service";
import { AccountMatchingShadowComparisonService } from "./shadow/account-matching-shadow-comparison.service";

@Module({
  imports: [
    IndustriesModule,
    SiiAccountPlanModule,
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
      AccountMatchingConfirmationEntity,
      AccountMatchingLearningIndustryEntity,
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
    AccountMatchingConfirmationService,
    LearningAggregatorService,
    ExpertAccountMappingImportService,
    MatchingResolutionContextFactoryService,
    AccountObservationClassifierService,
    {
      provide: SiiAccountMatchingPipelineService,
      useFactory: () => new SiiAccountMatchingPipelineService(),
    },
    SiiAccountMatchingV2EvaluationService,
    AccountMatchingShadowComparisonService,
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
    AccountMatchingConfirmationService,
    LearningAggregatorService,
    ExpertAccountMappingImportService,
    MatchingResolutionContextFactoryService,
    SiiAccountMatchingV2EvaluationService,
    AccountMatchingShadowComparisonService,
  ],
})
export class SiiAccountMatchingModule {}

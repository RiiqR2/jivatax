import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Repository } from "typeorm";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { AccountMatchingConfirmationEntity } from "../entities/account-matching-confirmation.entity";
import type { AccountMatchingFeedbackEntity } from "../entities/account-matching-feedback.entity";
import type { AccountMatchingLearningIndustryEntity } from "../entities/account-matching-learning-industry.entity";
import type { AccountMatchingLearningEntity } from "../entities/account-matching-learning.entity";
import type { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import { AccountMatchingCoverageService } from "./account-matching-coverage.service";

describe("AccountMatchingCoverageService", () => {
  it("mantiene el aprendizaje global separado de la versión del catálogo", async () => {
    const confirmations = {
      count: async () => 3,
    } as unknown as Repository<AccountMatchingConfirmationEntity>;
    const service = new AccountMatchingCoverageService(
      {} as Repository<SiiAccountEntity>,
      {} as Repository<SiiAccountTermEntity>,
      {} as Repository<SiiAccountConceptEntity>,
      {} as Repository<AccountMatchingLearningEntity>,
      {} as Repository<AccountMatchingLearningIndustryEntity>,
      confirmations,
      {} as Repository<AccountMatchingFeedbackEntity>,
    );
    Object.assign(service as object, {
      getLearningSummary: async () => ({
        learningCount: "145",
        averageConfidence: "0.75",
      }),
      getConfirmationSummary: async () => ({
        activeConfirmationCount: "200",
        expertConfirmationCount: "145",
        contributingCompanyCount: "8",
        industryCount: "4",
        lastEvidenceAt: "2026-07-31T00:00:00.000Z",
        recentConfirmationCount: "12",
        previousPeriodConfirmationCount: "8",
      }),
      getDistribution: async () => ({ high: 90, medium: 40, low: 15 }),
      getDiversity: async () => ({
        singleCompany: "80",
        multipleCompany: "65",
        expertOnly: "100",
        mixedEvidence: "35",
      }),
      getFeedbackSummary: async () => ({
        total: "20",
        accepted: "15",
        corrected: "2",
      }),
      getConflicts: async () => [],
      getIndustryCoverage: async () => [],
      getCatalogueReadiness: async (versionId: string) => ({
        versionId,
        total: 409,
        withAliases: 100,
        withoutAliases: 309,
        withConcepts: 200,
        withoutConcepts: 209,
        usedInLearning: 80,
        neverUsedInLearning: 329,
      }),
    });

    const result = await service.get("catalogue-version");

    assert.equal(result.global.learningCount, 145);
    assert.equal(result.global.activeConfirmationCount, 200);
    assert.equal(result.feedback.acceptanceRate, 0.75);
    assert.equal(result.feedback.correctionRate, 0.1);
    assert.equal(result.catalogue.versionId, "catalogue-version");
    assert.equal("accounts" in result.catalogue, false);
  });
});

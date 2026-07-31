import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, IsNull, Not, Repository } from "typeorm";
import { IndustryEntity } from "../../industries/entities/industry.entity";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { AccountMatchingConfirmationEntity } from "../entities/account-matching-confirmation.entity";
import { AccountMatchingFeedbackEntity } from "../entities/account-matching-feedback.entity";
import { AccountMatchingLearningIndustryEntity } from "../entities/account-matching-learning-industry.entity";
import { AccountMatchingLearningEntity } from "../entities/account-matching-learning.entity";
import { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import { SiiAccountTermEntity } from "../entities/sii-account-term.entity";

const HIGH_CONFIDENCE = 0.8;
const MEDIUM_CONFIDENCE = 0.55;
const MAX_CONFLICTS = 10;

type CountRow = { count: string };

@Injectable()
export class AccountMatchingCoverageService {
  constructor(
    @InjectRepository(SiiAccountEntity)
    private readonly accounts: Repository<SiiAccountEntity>,
    @InjectRepository(SiiAccountTermEntity)
    private readonly terms: Repository<SiiAccountTermEntity>,
    @InjectRepository(SiiAccountConceptEntity)
    private readonly concepts: Repository<SiiAccountConceptEntity>,
    @InjectRepository(AccountMatchingLearningEntity)
    private readonly learning: Repository<AccountMatchingLearningEntity>,
    @InjectRepository(AccountMatchingLearningIndustryEntity)
    private readonly industryLearning: Repository<AccountMatchingLearningIndustryEntity>,
    @InjectRepository(AccountMatchingConfirmationEntity)
    private readonly confirmations: Repository<AccountMatchingConfirmationEntity>,
    @InjectRepository(AccountMatchingFeedbackEntity)
    private readonly feedback: Repository<AccountMatchingFeedbackEntity>,
  ) {}

  async get(versionId: string) {
    const [
      learningSummary,
      confirmationSummary,
      invalidatedConfirmations,
      confidenceDistribution,
      agreementDistribution,
      diversity,
      feedbackSummary,
      conflicts,
      industries,
      catalogue,
    ] = await Promise.all([
      this.getLearningSummary(),
      this.getConfirmationSummary(),
      this.confirmations.count({
        where: { invalidatedAt: Not(IsNull()), deletedAt: IsNull() },
      }),
      this.getDistribution("learning.confidence"),
      this.getDistribution("learning.agreementRate"),
      this.getDiversity(),
      this.getFeedbackSummary(),
      this.getConflicts(),
      this.getIndustryCoverage(),
      this.getCatalogueReadiness(versionId),
    ]);

    return {
      global: {
        learningCount: this.number(learningSummary.learningCount),
        averageConfidence: this.number(learningSummary.averageConfidence),
        activeConfirmationCount: this.number(
          confirmationSummary.activeConfirmationCount,
        ),
        expertConfirmationCount: this.number(
          confirmationSummary.expertConfirmationCount,
        ),
        contributingCompanyCount: this.number(
          confirmationSummary.contributingCompanyCount,
        ),
        industryCount: this.number(confirmationSummary.industryCount),
        lastEvidenceAt: confirmationSummary.lastEvidenceAt ?? null,
        recentConfirmationCount: this.number(
          confirmationSummary.recentConfirmationCount,
        ),
        previousPeriodConfirmationCount: this.number(
          confirmationSummary.previousPeriodConfirmationCount,
        ),
      },
      quality: {
        confidence: confidenceDistribution,
        agreement: agreementDistribution,
      },
      diversity: {
        singleCompanyLearningCount: this.number(diversity.singleCompany),
        multipleCompanyLearningCount: this.number(diversity.multipleCompany),
        expertOnlyLearningCount: this.number(diversity.expertOnly),
        mixedEvidenceLearningCount: this.number(diversity.mixedEvidence),
        invalidatedConfirmationCount: invalidatedConfirmations,
      },
      conflicts,
      industries,
      feedback: {
        total: this.number(feedbackSummary.total),
        accepted: this.number(feedbackSummary.accepted),
        corrected: this.number(feedbackSummary.corrected),
        acceptanceRate: this.rate(
          feedbackSummary.accepted,
          feedbackSummary.total,
        ),
        correctionRate: this.rate(
          feedbackSummary.corrected,
          feedbackSummary.total,
        ),
      },
      catalogue,
    };
  }

  private getLearningSummary() {
    return this.learning
      .createQueryBuilder("learning")
      .select("COUNT(*)", "learningCount")
      .addSelect("AVG(learning.confidence)", "averageConfidence")
      .where("learning.deletedAt IS NULL")
      .getRawOne<{
        learningCount: string;
        averageConfidence: string | null;
      }>() as Promise<{
      learningCount: string;
      averageConfidence: string | null;
    }>;
  }

  private getConfirmationSummary() {
    return this.confirmations
      .createQueryBuilder("confirmation")
      .select("COUNT(*)", "activeConfirmationCount")
      .addSelect(
        "SUM(CASE WHEN confirmation.source = :expert THEN 1 ELSE 0 END)",
        "expertConfirmationCount",
      )
      .addSelect(
        "COUNT(DISTINCT confirmation.companyId)",
        "contributingCompanyCount",
      )
      .addSelect("COUNT(DISTINCT confirmation.industryId)", "industryCount")
      .addSelect("MAX(confirmation.confirmedAt)", "lastEvidenceAt")
      .addSelect(
        "SUM(CASE WHEN confirmation.confirmedAt >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY) THEN 1 ELSE 0 END)",
        "recentConfirmationCount",
      )
      .addSelect(
        "SUM(CASE WHEN confirmation.confirmedAt >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 60 DAY) AND confirmation.confirmedAt < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY) THEN 1 ELSE 0 END)",
        "previousPeriodConfirmationCount",
      )
      .where("confirmation.invalidatedAt IS NULL")
      .andWhere("confirmation.deletedAt IS NULL")
      .setParameter("expert", "expert")
      .getRawOne<{
        activeConfirmationCount: string;
        expertConfirmationCount: string | null;
        contributingCompanyCount: string;
        industryCount: string;
        lastEvidenceAt: Date | string | null;
        recentConfirmationCount: string | null;
        previousPeriodConfirmationCount: string | null;
      }>() as Promise<{
      activeConfirmationCount: string;
      expertConfirmationCount: string | null;
      contributingCompanyCount: string;
      industryCount: string;
      lastEvidenceAt: Date | string | null;
      recentConfirmationCount: string | null;
      previousPeriodConfirmationCount: string | null;
    }>;
  }

  private async getDistribution(field: string) {
    const row = await this.learning
      .createQueryBuilder("learning")
      .select(`SUM(CASE WHEN ${field} >= :high THEN 1 ELSE 0 END)`, "high")
      .addSelect(
        `SUM(CASE WHEN ${field} >= :medium AND ${field} < :high THEN 1 ELSE 0 END)`,
        "medium",
      )
      .addSelect(`SUM(CASE WHEN ${field} < :medium THEN 1 ELSE 0 END)`, "low")
      .where("learning.deletedAt IS NULL")
      .setParameters({ high: HIGH_CONFIDENCE, medium: MEDIUM_CONFIDENCE })
      .getRawOne<{
        high: string | null;
        medium: string | null;
        low: string | null;
      }>();
    return {
      high: this.number(row?.high),
      medium: this.number(row?.medium),
      low: this.number(row?.low),
    };
  }

  private getDiversity() {
    return this.learning
      .createQueryBuilder("learning")
      .select(
        "SUM(CASE WHEN learning.distinctCompanyCount <= 1 THEN 1 ELSE 0 END)",
        "singleCompany",
      )
      .addSelect(
        "SUM(CASE WHEN learning.distinctCompanyCount > 1 THEN 1 ELSE 0 END)",
        "multipleCompany",
      )
      .addSelect(
        "SUM(CASE WHEN learning.expertConfirmationCount = learning.confirmationCount THEN 1 ELSE 0 END)",
        "expertOnly",
      )
      .addSelect(
        "SUM(CASE WHEN learning.expertConfirmationCount > 0 AND learning.expertConfirmationCount < learning.confirmationCount THEN 1 ELSE 0 END)",
        "mixedEvidence",
      )
      .where("learning.deletedAt IS NULL")
      .getRawOne<{
        singleCompany: string | null;
        multipleCompany: string | null;
        expertOnly: string | null;
        mixedEvidence: string | null;
      }>() as Promise<{
      singleCompany: string | null;
      multipleCompany: string | null;
      expertOnly: string | null;
      mixedEvidence: string | null;
    }>;
  }

  private getFeedbackSummary() {
    return this.feedback
      .createQueryBuilder("feedback")
      .select("COUNT(*)", "total")
      .addSelect(
        "SUM(CASE WHEN feedback.accepted = true THEN 1 ELSE 0 END)",
        "accepted",
      )
      .addSelect(
        "SUM(CASE WHEN feedback.corrected = true THEN 1 ELSE 0 END)",
        "corrected",
      )
      .getRawOne<{
        total: string;
        accepted: string | null;
        corrected: string | null;
      }>() as Promise<{
      total: string;
      accepted: string | null;
      corrected: string | null;
    }>;
  }

  private async getConflicts() {
    const conflictRows = await this.learning
      .createQueryBuilder("learning")
      .select("learning.normalizedNameHash", "normalizedNameHash")
      .addSelect("MAX(learning.normalizedName)", "normalizedName")
      .addSelect("COUNT(DISTINCT learning.siiAccountId)", "destinationCount")
      .addSelect("SUM(learning.confirmationCount)", "confirmationCount")
      .addSelect("MAX(learning.confidence)", "maximumConfidence")
      .addSelect("MIN(learning.agreementRate)", "minimumAgreementRate")
      .where("learning.deletedAt IS NULL")
      .groupBy("learning.normalizedNameHash")
      .having("COUNT(DISTINCT learning.siiAccountId) > 1")
      .orderBy("confirmationCount", "DESC")
      .addOrderBy("destinationCount", "DESC")
      .limit(MAX_CONFLICTS)
      .getRawMany<{
        normalizedNameHash: string;
        normalizedName: string;
        destinationCount: string;
        confirmationCount: string;
        maximumConfidence: string;
        minimumAgreementRate: string;
      }>();
    if (!conflictRows.length) return [];

    const hashes = conflictRows.map((row) => row.normalizedNameHash);
    const evidence = await this.learning.find({
      where: { normalizedNameHash: In(hashes), deletedAt: IsNull() },
    });
    const accountIds = Array.from(
      new Set(evidence.map((item) => item.siiAccountId)),
    );
    const accounts = await this.accounts.find({
      where: { id: In(accountIds), deletedAt: IsNull() },
    });
    const accountsById = new Map(
      accounts.map((account) => [account.id, account]),
    );

    return conflictRows.map((row) => ({
      normalizedName: row.normalizedName,
      destinationCount: this.number(row.destinationCount),
      confirmationCount: this.number(row.confirmationCount),
      maximumConfidence: this.number(row.maximumConfidence),
      minimumAgreementRate: this.number(row.minimumAgreementRate),
      candidates: evidence
        .filter((item) => item.normalizedNameHash === row.normalizedNameHash)
        .sort((left, right) => right.confirmationCount - left.confirmationCount)
        .map((item) => ({
          siiAccountId: item.siiAccountId,
          siiAccountCode: accountsById.get(item.siiAccountId)?.code ?? null,
          siiAccountName: accountsById.get(item.siiAccountId)?.name ?? null,
          confirmationCount: item.confirmationCount,
          distinctCompanyCount: item.distinctCompanyCount,
          agreementRate: this.number(item.agreementRate),
          confidence: this.number(item.confidence),
        })),
    }));
  }

  private async getIndustryCoverage() {
    const rows = await this.industryLearning
      .createQueryBuilder("industryLearning")
      .innerJoin(
        IndustryEntity,
        "industry",
        "industry.id = industryLearning.industryId",
      )
      .select("industryLearning.industryId", "industryId")
      .addSelect("industry.name", "industryName")
      .addSelect("COUNT(*)", "learnedNameCount")
      .addSelect("SUM(industryLearning.confirmationCount)", "confirmationCount")
      .addSelect("AVG(industryLearning.confidence)", "averageConfidence")
      .where("industryLearning.deletedAt IS NULL")
      .groupBy("industryLearning.industryId")
      .addGroupBy("industry.name")
      .orderBy("confirmationCount", "DESC")
      .getRawMany<{
        industryId: string;
        industryName: string;
        learnedNameCount: string;
        confirmationCount: string;
        averageConfidence: string;
      }>();
    if (!rows.length) return [];

    const companyRows = await this.confirmations
      .createQueryBuilder("confirmation")
      .select("confirmation.industryId", "industryId")
      .addSelect("COUNT(DISTINCT confirmation.companyId)", "companyCount")
      .where("confirmation.invalidatedAt IS NULL")
      .andWhere("confirmation.deletedAt IS NULL")
      .andWhere("confirmation.industryId IS NOT NULL")
      .groupBy("confirmation.industryId")
      .getRawMany<{ industryId: string; companyCount: string }>();
    const companiesByIndustry = new Map(
      companyRows.map((row) => [row.industryId, this.number(row.companyCount)]),
    );
    return rows.map((row) => ({
      industryId: row.industryId,
      industryName: row.industryName,
      companyCount: companiesByIndustry.get(row.industryId) ?? 0,
      learnedNameCount: this.number(row.learnedNameCount),
      confirmationCount: this.number(row.confirmationCount),
      averageConfidence: this.number(row.averageConfidence),
    }));
  }

  private async getCatalogueReadiness(versionId: string) {
    const total = await this.accounts.count({
      where: { versionId, deletedAt: IsNull() },
    });
    const [aliases, concepts, learned] = await Promise.all([
      this.countCoveredAccounts(this.terms, versionId, true),
      this.countCoveredAccounts(this.concepts, versionId, false),
      this.countLearningAccounts(versionId),
    ]);
    return {
      versionId,
      total,
      withAliases: aliases,
      withoutAliases: total - aliases,
      withConcepts: concepts,
      withoutConcepts: total - concepts,
      usedInLearning: learned,
      neverUsedInLearning: total - learned,
    };
  }

  private async countCoveredAccounts(
    repository: Repository<SiiAccountTermEntity | SiiAccountConceptEntity>,
    versionId: string,
    excludeNonAliasTerms: boolean,
  ) {
    const query = repository
      .createQueryBuilder("evidence")
      .innerJoin(
        SiiAccountEntity,
        "account",
        "account.id = evidence.siiAccountId",
      )
      .select("COUNT(DISTINCT evidence.siiAccountId)", "count")
      .where("account.versionId = :versionId", { versionId })
      .andWhere("account.deletedAt IS NULL")
      .andWhere("evidence.active = true")
      .andWhere("evidence.deletedAt IS NULL");
    if (excludeNonAliasTerms)
      query.andWhere("evidence.type NOT IN (:...types)", {
        types: ["official_name", "negative_term"],
      });
    const row = await query.getRawOne<CountRow>();
    return this.number(row?.count);
  }

  private async countLearningAccounts(versionId: string) {
    const row = await this.learning
      .createQueryBuilder("learning")
      .innerJoin(
        SiiAccountEntity,
        "account",
        "account.id = learning.siiAccountId",
      )
      .select("COUNT(DISTINCT learning.siiAccountId)", "count")
      .where("account.versionId = :versionId", { versionId })
      .andWhere("account.deletedAt IS NULL")
      .andWhere("learning.deletedAt IS NULL")
      .getRawOne<CountRow>();
    return this.number(row?.count);
  }

  private number(value: string | number | null | undefined) {
    return Number(value ?? 0);
  }

  private rate(value: string | number | null, total: string | number | null) {
    const denominator = this.number(total);
    return denominator ? this.number(value) / denominator : 0;
  }
}

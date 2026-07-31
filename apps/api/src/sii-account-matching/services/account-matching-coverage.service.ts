import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import { AccountMatchingLearningEntity } from "../entities/account-matching-learning.entity";
import { AccountMatchingDiagnosticEntity } from "../entities/account-matching-diagnostic.entity";
import { AccountMatchingFeedbackEntity } from "../entities/account-matching-feedback.entity";

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
    @InjectRepository(AccountMatchingDiagnosticEntity)
    private readonly diagnostics: Repository<AccountMatchingDiagnosticEntity>,
    @InjectRepository(AccountMatchingFeedbackEntity)
    private readonly feedback: Repository<AccountMatchingFeedbackEntity>,
  ) {}

  async get(versionId: string) {
    const accounts = await this.accounts.find({
      where: { versionId, deletedAt: IsNull() },
      order: { code: "ASC" },
    });
    const ids = new Set(accounts.map((account) => account.id));
    const [terms, concepts, learning, ambiguous, manualReviews, corrections] =
      await Promise.all([
        this.terms.find({ where: { active: true, deletedAt: IsNull() } }),
        this.concepts.find({ where: { active: true, deletedAt: IsNull() } }),
        this.learning.find({ where: { active: true, deletedAt: IsNull() } }),
        this.diagnostics.countBy({
          decision: "ambiguous",
          deletedAt: IsNull(),
        }),
        this.feedback.count(),
        this.feedback.countBy({ corrected: true }),
      ]);
    const aliasIds = new Set(
      terms
        .filter(
          (term) =>
            ids.has(term.siiAccountId) &&
            term.type !== "official_name" &&
            term.type !== "negative_term",
        )
        .map((term) => term.siiAccountId),
    );
    const conceptIds = new Set(
      concepts
        .filter((concept) => ids.has(concept.siiAccountId))
        .map((concept) => concept.siiAccountId),
    );
    const learnedIds = new Set(
      learning
        .filter((item) => ids.has(item.siiAccountId))
        .map((item) => item.siiAccountId),
    );
    return {
      versionId,
      total: accounts.length,
      withAliases: aliasIds.size,
      withoutAliases: accounts.length - aliasIds.size,
      withConcepts: conceptIds.size,
      withoutConcepts: accounts.length - conceptIds.size,
      usedInLearning: learnedIds.size,
      neverUsedInLearning: accounts.length - learnedIds.size,
      ambiguous,
      manuallyReviewed: manualReviews,
      correctedAfterReview: corrections,
      accounts: accounts.map((account) => ({
        code: account.code,
        name: account.name,
        hasAliases: aliasIds.has(account.id),
        hasConcepts: conceptIds.has(account.id),
        usedInLearning: learnedIds.has(account.id),
      })),
    };
  }
}

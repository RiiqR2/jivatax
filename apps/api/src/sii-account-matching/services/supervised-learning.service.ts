import { Injectable } from "@nestjs/common";
import { IsNull, type EntityManager, type FindOptionsWhere } from "typeorm";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import {
  AccountMatchingLearningEntity,
  type LearningScope,
} from "../entities/account-matching-learning.entity";

export const LEARNING_PROMOTION_MINIMUM_COMPANIES = 5;

@Injectable()
export class SupervisedLearningService {
  async recordConfirmation(
    manager: EntityManager,
    input: {
      companyId: string;
      internalName: string;
      siiAccountId: string;
      userId: string;
    },
  ): Promise<void> {
    const company = await manager
      .getRepository(CompanyEntity)
      .findOneByOrFail({ id: input.companyId });
    const normalizedName = normalizeAccountTerm(input.internalName);
    await this.increment(
      manager,
      "company",
      input,
      normalizedName,
      company.businessActivity,
    );
    if (company.businessActivity)
      await this.increment(
        manager,
        "industry",
        input,
        normalizedName,
        company.businessActivity,
      );
    await this.increment(manager, "global", input, normalizedName, null);

    const repository = manager.getRepository(AccountMatchingLearningEntity);
    const companyRows = await repository.find({
      where: {
        scope: "company",
        normalizedName,
        siiAccountId: input.siiAccountId,
        active: true,
      },
    });
    const global = await repository.findOneBy({
      scope: "global",
      companyId: IsNull(),
      industry: IsNull(),
      normalizedName,
      siiAccountId: input.siiAccountId,
    });
    if (global) {
      global.distinctCompanyCount = new Set(
        companyRows.map((row) => row.companyId),
      ).size;
      global.promotionEligible =
        global.distinctCompanyCount >= LEARNING_PROMOTION_MINIMUM_COMPANIES;
      await repository.save(global);
    }
  }

  private async increment(
    manager: EntityManager,
    scope: LearningScope,
    input: {
      companyId: string;
      internalName: string;
      siiAccountId: string;
      userId: string;
    },
    normalizedName: string,
    industry: string | null,
  ) {
    const repository = manager.getRepository(AccountMatchingLearningEntity);
    const values = {
      scope,
      companyId: scope === "company" ? input.companyId : null,
      industry: scope === "industry" ? industry : null,
      normalizedName,
      siiAccountId: input.siiAccountId,
    };
    const identity: FindOptionsWhere<AccountMatchingLearningEntity> = {
      scope,
      companyId: values.companyId ?? IsNull(),
      industry: values.industry ?? IsNull(),
      normalizedName,
      siiAccountId: input.siiAccountId,
    };
    const current = await repository.findOneBy(identity);
    const now = new Date();
    if (current) {
      current.confirmationCount += 1;
      current.lastConfirmedAt = now;
      current.lastConfirmedByUserId = input.userId;
      await repository.save(current);
      return;
    }
    await repository.save(
      repository.create({
        ...values,
        internalName: input.internalName,
        confirmationCount: 1,
        distinctCompanyCount: 1,
        lastConfirmedAt: now,
        lastConfirmedByUserId: input.userId,
        promotionEligible: false,
        active: true,
      }),
    );
  }
}

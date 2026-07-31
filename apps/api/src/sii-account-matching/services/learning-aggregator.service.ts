import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, IsNull } from "typeorm";
import { AccountMatchingConfirmationEntity } from "../entities/account-matching-confirmation.entity";
import { AccountMatchingLearningIndustryEntity } from "../entities/account-matching-learning-industry.entity";
import { AccountMatchingLearningEntity } from "../entities/account-matching-learning.entity";

@Injectable()
export class LearningAggregatorService {
  constructor(private readonly dataSource: DataSource) {}
  /** Consensus weighted by a transparent company sample factor, capped at five companies. */
  calculateConfidence(
    agreementRate: number,
    distinctCompanies: number,
  ): number {
    return agreementRate * Math.min(1, distinctCompanies / 5);
  }
  rebuild(): Promise<void> {
    return this.dataSource.transaction((manager) =>
      this.rebuildWithManager(manager),
    );
  }
  async rebuildWithManager(manager: EntityManager): Promise<void> {
    const confirmations = await manager
      .getRepository(AccountMatchingConfirmationEntity)
      .findBy({ invalidatedAt: IsNull() });
    const totals = new Map<string, number>();
    for (const item of confirmations)
      totals.set(
        item.normalizedNameHash,
        (totals.get(item.normalizedNameHash) ?? 0) + 1,
      );
    const groups = new Map<string, AccountMatchingConfirmationEntity[]>();
    for (const item of confirmations) {
      const key = `${item.normalizedNameHash}:${item.siiAccountId}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    await manager
      .getRepository(AccountMatchingLearningIndustryEntity)
      .delete({});
    await manager.getRepository(AccountMatchingLearningEntity).delete({});
    for (const rows of groups.values()) {
      const first = rows[0];
      const agreement =
        rows.length / (totals.get(first.normalizedNameHash) ?? rows.length);
      const companies = new Set(
        rows.flatMap((row) => (row.companyId ? [row.companyId] : [])),
      );
      const learning = await manager.save(
        AccountMatchingLearningEntity,
        manager.create(AccountMatchingLearningEntity, {
          normalizedName: first.normalizedName,
          normalizedNameHash: first.normalizedNameHash,
          siiAccountId: first.siiAccountId,
          confirmationCount: rows.length,
          distinctCompanyCount: companies.size,
          agreementRate: agreement.toFixed(6),
          confidence: this.calculateConfidence(
            agreement,
            companies.size,
          ).toFixed(6),
          lastConfirmedAt: new Date(
            Math.max(...rows.map((row) => row.confirmedAt.getTime())),
          ),
        }),
      );
      const industryRows = new Map<
        string,
        AccountMatchingConfirmationEntity[]
      >();
      for (const row of rows)
        if (row.industryId)
          industryRows.set(row.industryId, [
            ...(industryRows.get(row.industryId) ?? []),
            row,
          ]);
      for (const [industryId, evidence] of industryRows) {
        const industryTotal = confirmations.filter(
          (row) =>
            row.industryId === industryId &&
            row.normalizedNameHash === first.normalizedNameHash,
        ).length;
        const industryCompanies = new Set(
          evidence.flatMap((row) => (row.companyId ? [row.companyId] : [])),
        );
        const rate = evidence.length / industryTotal;
        await manager.save(
          AccountMatchingLearningIndustryEntity,
          manager.create(AccountMatchingLearningIndustryEntity, {
            learningId: learning.id,
            industryId,
            confirmationCount: evidence.length,
            distinctCompanyCount: industryCompanies.size,
            agreementRate: rate.toFixed(6),
            confidence: this.calculateConfidence(
              rate,
              industryCompanies.size,
            ).toFixed(6),
            lastConfirmedAt: new Date(
              Math.max(...evidence.map((row) => row.confirmedAt.getTime())),
            ),
          }),
        );
      }
    }
  }
}

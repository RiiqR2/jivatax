import { Injectable } from "@nestjs/common";
import { DataSource, EntityManager, IsNull } from "typeorm";
import {
  AccountMatchingConfirmationEntity,
  ConfirmationSource,
} from "../entities/account-matching-confirmation.entity";
import { AccountMatchingLearningIndustryEntity } from "../entities/account-matching-learning-industry.entity";
import { AccountMatchingLearningEntity } from "../entities/account-matching-learning.entity";

@Injectable()
export class LearningAggregatorService {
  constructor(private readonly dataSource: DataSource) {}
  /** Expert review starts strongly, but remains below five-company evidence. */
  calculateConfidence(
    agreementRate: number,
    distinctCompanies: number,
    expertConfirmations = 0,
  ): number {
    return calculateLearningConfidence(
      agreementRate,
      distinctCompanies,
      expertConfirmations,
    );
  }
  rebuild(): Promise<void> {
    return this.dataSource.transaction((manager) =>
      this.rebuildWithManager(manager),
    );
  }

  async rebuildWithManager(manager: EntityManager): Promise<void> {
    const confirmationRepository = manager.getRepository(
      AccountMatchingConfirmationEntity,
    );

    const learningIndustryRepository = manager.getRepository(
      AccountMatchingLearningIndustryEntity,
    );

    const learningRepository = manager.getRepository(
      AccountMatchingLearningEntity,
    );

    const confirmations = await confirmationRepository.findBy({
      invalidatedAt: IsNull(),
    });

    const totals = new Map<string, number>();

    for (const item of confirmations) {
      totals.set(
        item.normalizedNameHash,
        (totals.get(item.normalizedNameHash) ?? 0) + 1,
      );
    }

    const groups = new Map<
      string,
      AccountMatchingConfirmationEntity[]
    >();

    for (const item of confirmations) {
      const key = `${item.normalizedNameHash}:${item.siiAccountId}`;

      groups.set(key, [
        ...(groups.get(key) ?? []),
        item,
      ]);
    }

    await learningIndustryRepository
      .createQueryBuilder()
      .delete()
      .execute();

    await learningRepository
      .createQueryBuilder()
      .delete()
      .execute();

    for (const rows of groups.values()) {
      const first = rows[0];

      const agreement =
        rows.length /
        (totals.get(first.normalizedNameHash) ?? rows.length);

      const companies = new Set(
        rows.flatMap((row) =>
          row.companyId ? [row.companyId] : [],
        ),
      );

      const experts = rows.filter(
        (row) => row.source === ConfirmationSource.EXPERT,
      ).length;

      const learning = await learningRepository.save(
        learningRepository.create({
          normalizedName: first.normalizedName,
          normalizedNameHash: first.normalizedNameHash,
          siiAccountId: first.siiAccountId,
          confirmationCount: rows.length,
          expertConfirmationCount: experts,
          distinctCompanyCount: companies.size,
          agreementRate: agreement.toFixed(6),
          confidence: this.calculateConfidence(
            agreement,
            companies.size,
            experts,
          ).toFixed(6),
          lastConfirmedAt: new Date(
            Math.max(
              ...rows.map((row) => row.confirmedAt.getTime()),
            ),
          ),
        }),
      );

      const industryRows = new Map<
        string,
        AccountMatchingConfirmationEntity[]
      >();

      for (const row of rows) {
        if (!row.industryId) {
          continue;
        }

        industryRows.set(row.industryId, [
          ...(industryRows.get(row.industryId) ?? []),
          row,
        ]);
      }

      for (const [industryId, evidence] of industryRows) {
        const industryTotal = confirmations.filter(
          (row) =>
            row.industryId === industryId &&
            row.normalizedNameHash === first.normalizedNameHash,
        ).length;

        const industryCompanies = new Set(
          evidence.flatMap((row) =>
            row.companyId ? [row.companyId] : [],
          ),
        );

        const industryExperts = evidence.filter(
          (row) => row.source === ConfirmationSource.EXPERT,
        ).length;

        const rate = evidence.length / industryTotal;

        await learningIndustryRepository.save(
          learningIndustryRepository.create({
            learningId: learning.id,
            industryId,
            confirmationCount: evidence.length,
            expertConfirmationCount: industryExperts,
            distinctCompanyCount: industryCompanies.size,
            agreementRate: rate.toFixed(6),
            confidence: this.calculateConfidence(
              rate,
              industryCompanies.size,
              industryExperts,
            ).toFixed(6),
            lastConfirmedAt: new Date(
              Math.max(
                ...evidence.map(
                  (row) => row.confirmedAt.getTime(),
                ),
              ),
            ),
          }),
        );
      }
    }
  }
}

/** An expert mapping is valuable evidence, without being treated as certainty. */
export const EXPERT_BASE_WEIGHT = 0.8;
export function calculateLearningConfidence(
  agreementRate: number,
  distinctCompanyCount: number,
  expertConfirmationCount: number,
): number {
  const companyStrength = Math.min(1, Math.max(0, distinctCompanyCount) / 5);
  const expertStrength = expertConfirmationCount > 0 ? EXPERT_BASE_WEIGHT : 0;
  return agreementRate * Math.max(companyStrength, expertStrength);
}

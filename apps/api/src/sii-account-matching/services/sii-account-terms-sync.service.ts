import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, IsNull, Repository } from "typeorm";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import {
  SII_ACCOUNT_ALIASES,
  type CuratedSiiAccountKnowledge,
} from "../data/sii-account-aliases";
import {
  SiiAccountTermEntity,
  type SiiAccountTermType,
} from "../entities/sii-account-term.entity";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";

export type TermsSyncSummary = {
  siiAccountsRead: number;
  officialTermsCreated: number;
  aliasesCreated: number;
  negativeTermsCreated: number;
  existingTermsSkipped: number;
  inactiveTermsSkipped: number;
  missingReferencedAccounts: string[];
  errors: number;
};

type TermCandidate = {
  account: SiiAccountEntity;
  term: string;
  type: SiiAccountTermType;
  weight: number;
  source: string;
};

@Injectable()
export class SiiAccountTermsSyncService {
  private readonly logger = new Logger(SiiAccountTermsSyncService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async synchronize(
    knowledge: readonly CuratedSiiAccountKnowledge[] = SII_ACCOUNT_ALIASES,
  ): Promise<TermsSyncSummary> {
    const accountsRepository = this.dataSource.getRepository(SiiAccountEntity);
    const termsRepository = this.dataSource.getRepository(SiiAccountTermEntity);
    const accounts = await accountsRepository
      .createQueryBuilder("account")
      .innerJoin("account.version", "version", "version.status = :status", {
        status: "active",
      })
      .where("account.deletedAt IS NULL")
      .getMany();
    const summary: TermsSyncSummary = {
      siiAccountsRead: accounts.length,
      officialTermsCreated: 0,
      aliasesCreated: 0,
      negativeTermsCreated: 0,
      existingTermsSkipped: 0,
      inactiveTermsSkipped: 0,
      missingReferencedAccounts: [],
      errors: 0,
    };
    const byCode = new Map(accounts.map((account) => [account.code, account]));
    const candidates: TermCandidate[] = accounts.map((account) => ({
      account,
      term: account.name,
      type: "official_name",
      weight: 45,
      source: "sii_catalog",
    }));

    for (const entry of knowledge) {
      const account = byCode.get(entry.siiAccountCode);
      if (!account) {
        summary.missingReferencedAccounts.push(entry.siiAccountCode);
        this.logger.warn(
          `No existe cuenta SII activa referenciada: ${entry.siiAccountCode}`,
        );
        continue;
      }
      candidates.push(
        ...entry.terms.map((term) => ({
          account,
          ...term,
          source: "jivatax_curated",
        })),
      );
    }

    for (const candidate of candidates) {
      await this.createIfMissing(termsRepository, candidate, summary);
    }
    return summary;
  }

  private async createIfMissing(
    repository: Repository<SiiAccountTermEntity>,
    candidate: TermCandidate,
    summary: TermsSyncSummary,
  ): Promise<void> {
    const normalizedTerm = normalizeAccountTerm(candidate.term);
    try {
      const existing = await repository.findOne({
        where: {
          siiAccountId: candidate.account.id,
          companyId: IsNull(),
          normalizedTerm,
          type: candidate.type,
          source: candidate.source,
          scope: "global",
        },
        withDeleted: true,
      });
      if (existing) {
        if (existing.active) summary.existingTermsSkipped++;
        else summary.inactiveTermsSkipped++;
        return;
      }
      await repository.save(
        repository.create({
          siiAccountId: candidate.account.id,
          companyId: null,
          scope: "global",
          term: candidate.term,
          normalizedTerm,
          type: candidate.type,
          weight: candidate.weight,
          source: candidate.source,
          active: true,
        }),
      );
      if (candidate.type === "official_name") summary.officialTermsCreated++;
      else if (candidate.type === "negative_term")
        summary.negativeTermsCreated++;
      else summary.aliasesCreated++;
    } catch (error) {
      summary.errors++;
      this.logger.error(
        `Error sincronizando ${candidate.account.code}/${candidate.term}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}

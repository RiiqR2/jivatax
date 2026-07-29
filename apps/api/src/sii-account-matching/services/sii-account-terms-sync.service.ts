import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { randomUUID } from "node:crypto";
import {
  SII_ACCOUNT_ALIASES,
  type CuratedSiiAccountKnowledge,
} from "../data/sii-account-aliases";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";

export type TermsSyncSummary = {
  siiAccountsRead: number;
  officialTermsCreated: number;
  aliasesCreated: number;
  negativeTermsCreated: number;
  existingTermsSkipped: number;
  termsOmitted: number;
  missingReferencedAccounts: string[];
  errors: number;
};

@Injectable()
export class SiiAccountTermsSyncService {
  private readonly logger = new Logger(SiiAccountTermsSyncService.name);
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async synchronize(
    knowledge: readonly CuratedSiiAccountKnowledge[] = SII_ACCOUNT_ALIASES,
  ): Promise<TermsSyncSummary> {
    const accounts: Array<{ id: string; code: string; name: string }> =
      await this.dataSource.query(
        `SELECT account.id, account.code, account.name FROM sii_accounts account
       INNER JOIN sii_account_plan_versions version ON version.id = account.version_id
       WHERE account.deleted_at IS NULL AND version.status = 'active'`,
      );
    const summary: TermsSyncSummary = {
      siiAccountsRead: accounts.length,
      officialTermsCreated: 0,
      aliasesCreated: 0,
      negativeTermsCreated: 0,
      existingTermsSkipped: 0,
      termsOmitted: 0,
      missingReferencedAccounts: [],
      errors: 0,
    };
    const byCode = new Map(accounts.map((account) => [account.code, account]));
    const candidates = accounts
      .map((account) => ({
        account,
        term: account.name,
        type: "official_name",
        weight: 45,
        source: "sii_catalog",
      }))
      .concat(
        knowledge.flatMap((entry) => {
          const account = byCode.get(entry.siiAccountCode);
          if (!account) {
            summary.missingReferencedAccounts.push(entry.siiAccountCode);
            this.logger.warn(
              `No existe cuenta SII referenciada: ${entry.siiAccountCode}`,
            );
            return [];
          }
          return entry.terms.map((term) => ({
            account,
            ...term,
            source: "jivatax_curated",
          }));
        }),
      );
    for (const candidate of candidates) {
      const normalized = normalizeAccountTerm(candidate.term);
      if (!normalized) {
        summary.termsOmitted++;
        continue;
      }
      try {
        // INSERT IGNORE preserves disabled terms, metauser weights and all historical knowledge.
        const result = await this.dataSource.query(
          `INSERT IGNORE INTO sii_account_terms (id,sii_account_id,company_id,scope,term,normalized_term,type,weight,source,active,created_at,updated_at)
           VALUES (?,?,NULL,'global',?,?,?,?,?,1,NOW(6),NOW(6))`,
          [
            randomUUID(),
            candidate.account.id,
            candidate.term,
            normalized,
            candidate.type,
            candidate.weight,
            candidate.source,
          ],
        );
        const created = Number(result?.affectedRows ?? 0) > 0;
        if (!created) summary.existingTermsSkipped++;
        else if (candidate.type === "official_name")
          summary.officialTermsCreated++;
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
    return summary;
  }
}

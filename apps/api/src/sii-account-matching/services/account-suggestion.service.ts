import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { MATCHING_CONFIG } from "../matching.config";
import { rankSiiAccounts, type MatchAccount } from "../matcher";

@Injectable()
export class AccountSuggestionService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async generateForPeriod(companyId: string, taxPeriodId: string) {
    const accounts: Array<{ id: string; name: string }> =
      await this.dataSource.query(
        `SELECT DISTINCT account.id, account.name FROM tax_period_company_accounts period_account
       INNER JOIN company_accounts account ON account.id=period_account.company_account_id
       INNER JOIN company_account_mappings mapping ON mapping.company_account_id=account.id
       WHERE period_account.company_id=? AND period_account.tax_period_id=? AND mapping.status <> 'confirmed'`,
        [companyId, taxPeriodId],
      );
    const rows: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT sii.id, sii.code, sii.name, term.term, term.normalized_term AS normalizedTerm, term.type, term.weight, term.company_id AS companyId
       FROM sii_accounts sii INNER JOIN sii_account_plan_versions version ON version.id=sii.version_id
       LEFT JOIN sii_account_terms term ON term.sii_account_id=sii.id AND term.active=1 AND (term.company_id IS NULL OR term.company_id=?)
       WHERE sii.deleted_at IS NULL AND version.status='active'`,
      [companyId],
    );
    const candidates = new Map<string, MatchAccount>();
    for (const row of rows) {
      let candidate = candidates.get(String(row.id));
      if (!candidate) {
        candidate = {
          id: String(row.id),
          code: String(row.code),
          name: String(row.name),
          terms: [],
        };
        candidates.set(candidate.id, candidate);
      }
      if (row.term)
        candidate.terms.push({
          term: String(row.term),
          normalizedTerm: String(row.normalizedTerm),
          type: String(row.type),
          weight: Number(row.weight),
          companyId: row.companyId ? String(row.companyId) : null,
        });
    }
    let suggested = 0;
    await this.dataSource.transaction(async (manager) => {
      for (const account of accounts) {
        const ranked = rankSiiAccounts(account.name, companyId, [
          ...candidates.values(),
        ]);
        await manager.query(
          "UPDATE company_account_suggestions SET status='superseded',updated_at=NOW(6) WHERE company_account_id=? AND status='active'",
          [account.id],
        );
        for (let index = 0; index < ranked.length; index++) {
          const match = ranked[index];
          await manager.query(
            `INSERT INTO company_account_suggestions
            (id,company_account_id,sii_account_id,suggestion_rank,score,confidence,algorithm_version,reasons,status,generated_at,created_at,updated_at)
            VALUES (?,?,?,?,?,?,?,?,'active',NOW(6),NOW(6),NOW(6))`,
            [
              randomUUID(),
              account.id,
              match.id,
              index + 1,
              match.score,
              match.confidence,
              MATCHING_CONFIG.algorithmVersion,
              JSON.stringify(match.reasons),
            ],
          );
        }
        if (ranked.length) suggested++;
      }
    });
    return {
      processed: accounts.length,
      suggested,
      withoutSuggestion: accounts.length - suggested,
      algorithmVersion: MATCHING_CONFIG.algorithmVersion,
    };
  }
}

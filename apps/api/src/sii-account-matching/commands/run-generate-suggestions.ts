import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import { AppModule } from "../../app.module";
import { AccountSuggestionService } from "../services/account-suggestion.service";

function option(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`--${name} is required`);
  return value;
}

async function main() {
  const companyId = option("company-id");
  const taxPeriodId = option("tax-period-id");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const summary = await app
      .get(AccountSuggestionService)
      .generateForPeriod(companyId, taxPeriodId);
    process.stdout.write(`SUMMARY ${JSON.stringify(summary, null, 2)}\n`);

    const dataSource = app.get(DataSource);
    const rankOne = await dataSource.query(
      `SELECT s.status AS status, s.algorithm_version AS algorithmVersion, COUNT(*) AS count
       FROM company_account_suggestions s
       JOIN tax_period_company_accounts tpca
         ON tpca.company_account_id = s.company_account_id
        AND tpca.tax_period_id = ?
        AND tpca.discarded_at IS NULL
       WHERE s.suggestion_rank = 1
       GROUP BY s.status, s.algorithm_version
       ORDER BY s.status, s.algorithm_version`,
      [taxPeriodId],
    );
    process.stdout.write(`RANK1_BY_STATUS ${JSON.stringify(rankOne)}\n`);

    const uiVisible = await dataSource.query(
      `SELECT s.status AS status, COUNT(*) AS count
       FROM company_account_suggestions s
       JOIN tax_period_company_accounts tpca
         ON tpca.company_account_id = s.company_account_id
        AND tpca.tax_period_id = ?
        AND tpca.discarded_at IS NULL
       JOIN company_account_mappings m
         ON m.company_account_id = s.company_account_id
       WHERE s.suggestion_rank = 1
         AND s.status IN ('active','review')
         AND m.status = 'pending'
       GROUP BY s.status`,
      [taxPeriodId],
    );
    process.stdout.write(`UI_VISIBLE_PRIMARY ${JSON.stringify(uiVisible)}\n`);

    const mappingStatus = await dataSource.query(
      `SELECT m.status AS status, COUNT(*) AS count
       FROM company_account_mappings m
       JOIN tax_period_company_accounts tpca
         ON tpca.company_account_id = m.company_account_id
        AND tpca.tax_period_id = ?
        AND tpca.discarded_at IS NULL
       GROUP BY m.status`,
      [taxPeriodId],
    );
    process.stdout.write(`MAPPING_STATUS ${JSON.stringify(mappingStatus)}\n`);
  } finally {
    await app.close();
  }
}
void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});

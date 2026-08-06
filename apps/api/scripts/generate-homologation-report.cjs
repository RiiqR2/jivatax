#!/usr/bin/env node
/**
 * Generates a structured homologation diagnostic report for company accounts
 * against the active SII catalog. Usage:
 *   node scripts/generate-homologation-report.cjs <companyId> <taxPeriodId>
 */
require("ts-node/register");
const { mkdirSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const { DataSource } = require("typeorm");
const {
  AccountSuggestionService,
} = require("../src/sii-account-matching/services/account-suggestion.service");

async function main() {
  const [companyId, taxPeriodId] = process.argv.slice(2);
  if (!companyId || !taxPeriodId) {
    console.error(
      "Usage: node scripts/generate-homologation-report.cjs <companyId> <taxPeriodId>",
    );
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: "mysql",
    host: process.env.DATABASE_HOST ?? process.env.DB_HOST ?? "127.0.0.1",
    port: Number(process.env.DATABASE_PORT ?? process.env.DB_PORT ?? 3306),
    username: process.env.DATABASE_USER ?? process.env.DB_USER ?? "root",
    password: process.env.DATABASE_PASSWORD ?? process.env.DB_PASSWORD ?? "",
    database: process.env.DATABASE_NAME ?? process.env.DB_NAME ?? "jivatax",
    entities: [`${__dirname}/../src/**/*.entity.ts`],
    synchronize: false,
  });

  await dataSource.initialize();
  try {
    const service = new AccountSuggestionService(dataSource);
    const result = await service.generateForPeriod(companyId, taxPeriodId);
    const reportPath = join(
      process.cwd(),
      "tmp",
      "homologation-reports",
      `${companyId}-${taxPeriodId}.json`,
    );
    console.log(
      JSON.stringify(
        {
          reportPath,
          accountsProcessed: result.accountsProcessed,
          suggestionsCreated: result.suggestionsCreated,
          orphanReferences: result.orphanReferences?.length ?? 0,
          remappedCatalogReferences: result.remappedCatalogReferences ?? 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

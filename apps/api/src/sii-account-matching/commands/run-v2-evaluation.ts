import "reflect-metadata";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module";
import { AccountMatchingEvaluationService } from "../evaluation/account-matching-evaluation.service";

function option(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index < 0 ? undefined : process.argv[index + 1];
  if (!value || value.startsWith("--"))
    throw new Error(`--${name} is required`);
  return value;
}

async function main() {
  const input = {
    companyId: option("company-id"),
    taxPeriodId: option("tax-period-id"),
    balanceImportId: option("balance-import-id"),
  };
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const report = await app
      .get(AccountMatchingEvaluationService)
      .evaluate(input);
    const directory = join(
      resolve(process.cwd(), "../.."),
      "tmp",
      "account-matching-evaluation",
    );
    await mkdir(directory, { recursive: true });
    const stamp = report.metadata.generatedAt.replace(/[:.]/g, "-");
    const file = join(
      directory,
      `${input.companyId}-${input.taxPeriodId}-${input.balanceImportId}-${stamp}.json`,
    );
    await writeFile(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${file}\n`);
  } finally {
    await app.close();
  }
}
void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});

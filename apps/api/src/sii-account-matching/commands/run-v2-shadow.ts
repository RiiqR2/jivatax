import "reflect-metadata";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module";
import { AccountMatchingShadowComparisonService } from "../shadow/account-matching-shadow-comparison.service";

function option(name: string): string {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || value.startsWith("--"))
    throw new Error(`--${name} is required`);
  return value;
}

function repositoryRoot(): string {
  let directory = resolve(process.cwd());
  while (basename(directory) !== "jivatax" && dirname(directory) !== directory)
    directory = dirname(directory);
  return directory;
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
      .get(AccountMatchingShadowComparisonService)
      .compare(input);
    const directory = join(repositoryRoot(), "tmp", "account-matching-shadow");
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

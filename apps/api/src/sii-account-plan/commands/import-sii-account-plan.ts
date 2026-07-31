import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module";
import { SiiAccountPlanImportService } from "../services/sii-account-plan-import.service";

interface CliOptions {
  file: string;
  sheet?: string;
  dryRun: boolean;
}

function parseArguments(arguments_: string[]): CliOptions {
  const value = (flag: string): string | undefined => {
    const index = arguments_.indexOf(flag);
    return index >= 0 ? arguments_[index + 1] : undefined;
  };
  const file = value("--file");
  if (!file) {
    throw new Error("Uso: --file <archivo.xlsx> [--sheet <hoja>] [--dry-run]");
  }
  return {
    file,
    sheet: value("--sheet"),
    dryRun: arguments_.includes("--dry-run"),
  };
}

async function run(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const report = await application
      .get(SiiAccountPlanImportService)
      .import(options);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.errors.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await application.close();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});

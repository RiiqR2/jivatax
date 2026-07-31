import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module";
import { ExpertAccountMappingImportService } from "../expert-import/expert-account-mapping-import.service";

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}
async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const file = option(args, "--file");
  if (!file)
    throw new Error(
      "Uso: --file <archivo.xlsx> [--sheet <nombre>] [--dry-run] [--confirmed-by-user-id <uuid>] [--industry-id <uuid>] [--no-rebuild]",
    );
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const report = await app.get(ExpertAccountMappingImportService).import({
      file,
      sheet: option(args, "--sheet"),
      dryRun: args.includes("--dry-run"),
      confirmedByUserId: option(args, "--confirmed-by-user-id"),
      industryId: option(args, "--industry-id"),
      rebuild: !args.includes("--no-rebuild"),
    });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await app.close();
  }
}
void run().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`,
  );
  process.exitCode = 1;
});

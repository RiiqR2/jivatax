import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module";
import { CuratedApplicabilitySyncService } from "../services/curated-applicability-sync.service";

export async function main() {
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const result = await context
      .get(CuratedApplicabilitySyncService)
      .synchronize();
    const { report } = result;
    console.log("Curated work-paper applicability sync completed");
    console.log(`- Matrix version: ${result.matrixVersion}`);
    console.log(`- Source rows A.1-A.20: ${report.sourceRowsA1ToA20}`);
    console.log(`- Valid associations: ${report.validAssociations.length}`);
    console.log(`- Inserted: ${result.inserted}`);
    console.log(`- Reactivated: ${result.reactivated}`);
    console.log(`- Unchanged: ${result.unchanged}`);
    console.log(`- Duplicate source groups: ${report.duplicateRows.length}`);
    console.log(
      `- Missing catalog codes: ${report.missingCatalogCodes.length}`,
    );
    for (const miss of report.missingCatalogCodes)
      console.log(
        `  - ${miss.siiAccountCode} (rows ${miss.sourceRows.join(",")})`,
      );
    console.log(
      `- Codes with multiple papers: ${report.codesWithMultiplePapers.length}`,
    );
    for (const multi of report.codesWithMultiplePapers)
      console.log(
        `  - ${multi.siiAccountCode} -> ${multi.workPaperCodes.join(", ")}`,
      );
    console.log(
      `- Papers without associations: ${report.papersWithoutAssociations.join(", ") || "(none)"}`,
    );
    console.log(`- Ignored source rows: ${report.ignoredRows.length}`);
    const byReason = report.ignoredRows.reduce<Record<string, number>>(
      (acc, row) => {
        acc[row.reason] = (acc[row.reason] ?? 0) + 1;
        return acc;
      },
      {},
    );
    for (const [reason, count] of Object.entries(byReason))
      console.log(`  - ${reason}: ${count}`);
    if (report.missingCatalogCodes.length) process.exitCode = 1;
  } finally {
    await context.close();
  }
}

if (require.main === module)
  void main().catch((error: unknown) => {
    console.error(
      `Curated applicability sync failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });

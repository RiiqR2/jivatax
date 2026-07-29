import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module";
import { SiiAccountTermsSyncService } from "../services/sii-account-terms-sync.service";

async function main() {
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const result = await context.get(SiiAccountTermsSyncService).synchronize();
    console.log("SII account terms synchronization completed");
    console.log(
      `- Total SII accounts in database: ${result.totalSiiAccountsInDatabase}`,
    );
    console.log(`- Versions found: ${result.versionsFound}`);
    console.log(`- Selected version ID: ${result.selectedVersionId}`);
    console.log(`- Selected version: ${result.selectedVersionLabel}`);
    console.log(`- SII accounts read: ${result.siiAccountsRead}`);
    console.log(`- Official terms created: ${result.officialTermsCreated}`);
    console.log(`- Aliases created: ${result.aliasesCreated}`);
    console.log(`- Negative terms created: ${result.negativeTermsCreated}`);
    console.log(`- Existing terms skipped: ${result.existingTermsSkipped}`);
    console.log(`- Inactive terms skipped: ${result.inactiveTermsSkipped}`);
    console.log(
      `- Missing referenced accounts: ${result.missingReferencedAccounts.length}`,
    );
    for (const code of result.missingReferencedAccounts)
      console.log(`  - ${code}`);
    console.log(`- Errors: ${result.errors}`);
    if (result.errors) process.exitCode = 1;
  } finally {
    await context.close();
  }
}
void main();

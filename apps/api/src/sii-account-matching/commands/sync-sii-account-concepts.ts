import { NestFactory } from "@nestjs/core";
import { DataSource } from "typeorm";
import { AppModule } from "../../app.module";
import { SiiAccountConceptsSyncService } from "../services/sii-account-concepts-sync.service";
import { assertSyncEntitiesMetadata } from "./sync-entities-metadata";

export async function main() {
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    assertSyncEntitiesMetadata(context.get(DataSource));
    const result = await context
      .get(SiiAccountConceptsSyncService)
      .synchronize();
    console.log("SII account concepts synchronization completed");
    for (const [key, value] of Object.entries(result))
      console.log(`- ${key}: ${Array.isArray(value) ? value.length : value}`);
    for (const code of result.missingReferencedAccounts)
      console.log(`  - ${code}`);
    if (result.errors) process.exitCode = 1;
  } finally {
    await context.close();
  }
}

if (require.main === module)
  void main().catch((error: unknown) => {
    console.error(
      `SII account concepts synchronization failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });

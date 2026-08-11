import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../app.module";
import { TaxWorkPapersService } from "../tax-work-papers.service";

const COMPANY_ID =
  process.env.COMPANY_ID ?? "697f929f-4fe2-48cd-9d68-70bc73e29e23";
const TAX_PERIOD_ID =
  process.env.TAX_PERIOD_ID ?? "9df21562-1506-4e06-94d8-6e6dc794df45";

export async function main() {
  const context = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  try {
    const detected = await context
      .get(TaxWorkPapersService)
      .detectApplicable(COMPANY_ID, TAX_PERIOD_ID);
    console.log(
      JSON.stringify(
        {
          companyId: COMPANY_ID,
          taxPeriodId: TAX_PERIOD_ID,
          detectedCount: detected.length,
          papers: detected.map((item) => ({
            code: item.code,
            name: item.name,
            siiCodes: [
              ...new Set(item.relatedAccounts.map((a) => a.siiAccountCode)),
            ],
            accounts: item.relatedAccounts.map((a) => ({
              roleKey: a.roleKey,
              siiAccountCode: a.siiAccountCode,
              siiAccountName: a.siiAccountName,
              companyAccountCode: a.companyAccountCode,
              companyAccountName: a.companyAccountName,
            })),
            executions: item.executions,
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await context.close();
  }
}

if (require.main === module)
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });

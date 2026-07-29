import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("administration keeps the active company in memory", async () => {
  const provider = await source("src/providers/active-company-provider.tsx");

  assert.match(provider, /useState<string \| null>\([\s\S]*companyId/);
  assert.match(
    provider,
    /if \(companyId\)[\s\S]*setActiveCompanyId\(companyId\)/,
  );
  assert.match(
    provider,
    /const resolvedCompanyId = companyId \?\? activeCompanyId/,
  );
});

test("the admin header returns to the active company or company selection", async () => {
  const header = await source("src/components/layout/app-header.tsx");

  assert.match(header, /Volver a la empresa/);
  assert.match(header, /companyEntryPath\(companyId, periods\)/);
  assert.match(header, /router\.push\("\/"\)/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("company industry selector uses debounce, explicit creation and industryId payload", () => {
  const selector = readFileSync(
    "src/components/companies/industry-selector.tsx",
    "utf8",
  );
  const payload = readFileSync(
    "src/services/admin-companies.service.ts",
    "utf8",
  );
  assert.match(selector, /setTimeout[\s\S]*300/);
  assert.match(selector, /\+ Crear rubro/);
  assert.match(selector, /status === 409/);
  assert.match(payload, /industryId: input\.industryId/);
  assert.doesNotMatch(payload, /industryName/);
});

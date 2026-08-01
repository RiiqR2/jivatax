import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL(
    "../src/components/accounting/account-mapping-page.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("distingue el nombre observado del nombre histórico sin llamarlo modificado", () => {
  assert.match(source, /\{item\.periodName\}/);
  assert.match(source, /Nombre histórico: \{item\.canonicalName\}/);
  assert.match(source, /Nombre del período: \{item\.periodName\}/);
  assert.doesNotMatch(source, /Nombre modificado · Canónico/);
});

test("presenta por separado una sugerencia pendiente de revisión", () => {
  assert.match(source, /Sugerencia pendiente de revisión/);
  assert.match(source, /status === "review"/);
});

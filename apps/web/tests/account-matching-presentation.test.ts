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

test("muestra sólo el nombre observado en la tabla y aclara el inicial en el modal", () => {
  assert.match(source, /\{item\.periodName\}/);
  assert.match(source, /Nombre observado: \{item\.periodName\}/);
  assert.match(source, /Nombre registrado inicialmente:/);
  assert.doesNotMatch(source, /Nombre histórico/);
  assert.doesNotMatch(source, /Canónico/);
  assert.doesNotMatch(source, /Nombre modificado · Canónico/);
});

test("presenta por separado una sugerencia pendiente de revisión", () => {
  assert.match(source, /Sugerencia pendiente de revisión/);
  assert.match(source, /status === "review"/);
});

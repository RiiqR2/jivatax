import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const navigation = readFileSync(
  new URL("../src/components/admin/admin-navigation.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL(
    "../src/components/admin/account-matching/admin-account-matching-summary-page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const service = readFileSync(
  new URL("../src/services/admin-sii-account-plan.service.ts", import.meta.url),
  "utf8",
);

describe("resumen administrativo de homologación", () => {
  it("está visible en la navegación global", () => {
    assert.match(navigation, /Resumen de homologación/);
    assert.match(navigation, /\/admin\/account-matching/);
  });

  it("presenta aprendizaje, aliases, conceptos y decisiones", () => {
    assert.match(page, /Usadas en aprendizaje/);
    assert.match(page, /Con aliases/);
    assert.match(page, /Con conceptos/);
    assert.match(page, /Decisiones ambiguas/);
  });

  it("consume el endpoint administrativo protegido", () => {
    assert.match(service, /admin\/sii-account-plan\/versions/);
    assert.match(service, /matching-coverage/);
  });
});

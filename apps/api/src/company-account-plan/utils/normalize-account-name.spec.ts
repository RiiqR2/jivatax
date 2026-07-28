import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAccountName } from "./normalize-account-name";

test("normalizeAccountName preserves meaningful words and removes accents", () => {
  assert.equal(
    normalizeAccountName("  Caja y Bancos — Moneda Nacional  "),
    "caja y bancos moneda nacional",
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAccountTerm } from "./account-term-normalizer";

test("normaliza tildes, puntuación, espacios y abreviaturas", () => {
  assert.equal(
    normalizeAccountTerm("  DÉP.  ACUM--MAQ.  "),
    "depreciacion acumulada maquinaria",
  );
  assert.equal(
    normalizeAccountTerm("DEPRECIACIÓN"),
    normalizeAccountTerm("dep."),
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAccountTerm,
  accountTokenWeight,
  relevantWords,
  weightedTokenSimilarity,
} from "./account-term-normalizer";

test("normaliza tildes, puntuación, espacios y abreviaturas", () => {
  assert.equal(
    normalizeAccountTerm("  DÉP.  ACUM--MAQ.  "),
    "depreciacion acumulada maquinarias",
  );
  assert.equal(
    normalizeAccountTerm("DEPRECIACIÓN"),
    normalizeAccountTerm("dep."),
  );
});

test("conserva tokens contables y elimina sólo stopwords estructurales", () => {
  const words = relevantWords(
    "CUENTAS DE IMPUESTO GASTO ACTIVO PASIVO GENERAL Y OTRAS",
  );
  assert.deepEqual(
    [...words],
    ["impuesto", "gasto", "activo", "pasivo", "general"],
  );
  assert.equal(accountTokenWeight("gasto"), 0.35);
  assert.equal(accountTokenWeight("general"), 0.35);
  assert.ok(weightedTokenSimilarity("gasto general", "gasto general") > 0);
});

test("expande abreviaturas contables sólo cuando son tokens completos", () => {
  assert.equal(
    normalizeAccountTerm("IVA CF CP"),
    "iva credito fiscal corto plazo",
  );
  assert.equal(
    normalizeAccountTerm("IVA DF LP"),
    "iva debito fiscal largo plazo",
  );
  assert.equal(
    normalizeAccountTerm("DEP ACUM MAQ"),
    "depreciacion acumulada maquinarias",
  );
  assert.equal(normalizeAccountTerm("PROV REM"), "proveedores remuneraciones");
  assert.equal(normalizeAccountTerm("REMATE"), "remate");
});

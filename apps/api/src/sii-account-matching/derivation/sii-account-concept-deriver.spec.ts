import assert from "node:assert/strict";
import test from "node:test";
import { decimalNumberTransformer } from "../entities/sii-account-concept.entity";
import { deriveConceptsFromSiiAccount } from "./sii-account-concept-deriver";

const derive = (name: string) => deriveConceptsFromSiiAccount({ name });
const has = (name: string, type: string, concept: string) =>
  derive(name).some((item) => item.type === type && item.concept === concept);

test("deriva corto y largo plazo solo desde frases estructurales", () => {
  assert.ok(
    has("Activos circulantes", "temporal_classification", "corto plazo"),
  );
  assert.ok(
    has("Obligaciones largo plazo", "temporal_classification", "largo plazo"),
  );
});

test("deriva pasivo y saldo acreedor desde por pagar", () => {
  assert.ok(has("Cuentas por pagar", "statement_section", "pasivo"));
  assert.ok(has("Cuentas por pagar", "balance_nature", "saldo acreedor"));
});

test("deriva cuentas por cobrar, activo y saldo deudor", () => {
  assert.ok(
    has("Documentos por cobrar", "accounting_family", "cuentas por cobrar"),
  );
  assert.ok(has("Deudores por ventas", "statement_section", "activo"));
});

test("deriva cuenta complementaria solo con depreciación o amortización menos", () => {
  assert.ok(
    has(
      "Depreciación (menos)",
      "contra_account_indicator",
      "cuenta complementaria de activo",
    ),
  );
  assert.ok(has("Amortización (menos)", "balance_nature", "saldo acreedor"));
  assert.equal(derive("Depreciación del período").length, 0);
});

test("deriva patrimonio, ingreso y gasto desde expresiones contables", () => {
  assert.ok(has("Capital pagado", "statement_section", "patrimonio"));
  assert.ok(has("Ventas nacionales", "statement_section", "ingreso"));
  assert.ok(has("Costo de ventas", "statement_section", "gasto"));
  assert.ok(has("Gastos administrativos", "balance_nature", "saldo deudor"));
});

test("no convierte tokens arbitrarios en conceptos", () => {
  assert.deepEqual(derive("Caja bancos clientes mercaderías"), []);
});

test("el transformer decimal hidrata weight como number", () => {
  assert.equal(decimalNumberTransformer.from("70.25"), 70.25);
  assert.equal(typeof decimalNumberTransformer.from("70.25"), "number");
  assert.equal(decimalNumberTransformer.to(70.25), 70.25);
});

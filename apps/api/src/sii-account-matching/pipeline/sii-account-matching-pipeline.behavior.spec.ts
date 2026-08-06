import assert from "node:assert/strict";
import { describe, it, test } from "node:test";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";
import { AccountObservationClassifierService } from "./account-observation-classifier.service";
import type { PipelineCatalogAccount } from "./account-matching-pipeline.types";
import { SiiAccountMatchingPipelineService } from "./sii-account-matching-pipeline.service";

const names = [
  "Disponible",
  "IVA Crédito Fiscal",
  "IVA Débito Fiscal",
  "Anticipo a proveedores",
  "Proveedores por pagar",
  "Obligaciones con bancos",
  "Capital emitido",
  "Existencias en tránsito",
  "Pagos basados en acciones",
  "Provisión gastos por pagar",
  "Cuentas por pagar",
  "Activo corriente",
  "Activo no corriente",
  "Ingreso por arriendo",
  "Gasto de arriendo",
  "Pasivo corriente",
  "Gastos rechazados",
  "Donaciones",
  "Gastos no documentados",
  "Multas tributarias",
  "Rentas extranjeras",
  "Impuestos diferidos",
  "Partes relacionadas",
];
const catalog: PipelineCatalogAccount[] = names.map((name, index) => ({
  id: `${index}`,
  code: `${index}`,
  name,
}));

describe("nuevo pipeline de homologación - comportamiento del dominio", () => {
  const pipeline = new SiiAccountMatchingPipelineService();
  const classifier = new AccountObservationClassifierService();
  const compatibility = new AccountCompatibilityFilterService(classifier);

  for (const [source, expected] of [
    ["Caja", "Disponible"],
    ["Banco", "Disponible"],
    ["IVA Crédito Fiscal", "IVA Crédito Fiscal"],
    ["IVA Débito Fiscal", "IVA Débito Fiscal"],
    ["Anticipo Proveedores", "Anticipo a proveedores"],
    ["Proveedores", "Proveedores por pagar"],
    ["Obligaciones bancarias", "Obligaciones con bancos"],
    ["Capital emitido", "Capital emitido"],
  ])
    test(`resuelve ${source} hacia la familia contable ${expected}`, () => {
      const result = pipeline.suggest(source, catalog);
      assert.notEqual(result.decision, "no_candidate");
      assert.equal(result.candidates[0].siiName, expected);
    });

  for (const [source, destination] of [
    ["Pagos en tránsito", "Existencias en tránsito"],
    ["Pagos en tránsito", "Pagos basados en acciones"],
    ["Provisión deuda incobrable", "Provisión gastos por pagar"],
    ["Préstamos por cobrar", "Cuentas por pagar"],
    ["Activo no corriente", "Activo corriente"],
    ["Activo corriente", "Activo no corriente"],
    ["Ingreso por arriendo", "Gasto de arriendo"],
    ["Gasto de arriendo", "Ingreso por arriendo"],
    ["Activo corriente", "Pasivo corriente"],
    ["Pasivo corriente", "Activo corriente"],
  ])
    test(`excluye ${source} → ${destination}`, () => {
      assert.equal(
        compatibility.evaluate(classifier.classify(source), destination)
          .compatible,
        false,
      );
    });

  for (const destination of [
    "Gastos rechazados",
    "Donaciones",
    "Gastos no documentados",
    "Multas tributarias",
    "Rentas extranjeras",
    "Impuestos diferidos",
    "Partes relacionadas",
  ])
    test(`protege la categoría tributaria ${destination} sin evidencia explícita`, () => {
      const result = compatibility.evaluate(
        classifier.classify("Gasto ordinario de administración"),
        destination,
      );
      assert.equal(result.compatible, false);
      assert.ok(
        result.exclusionReasons.includes(
          destination === "Partes relacionadas"
            ? "related_party_requires_explicit_evidence"
            : "protected_tax_category_requires_explicit_evidence",
        ),
      );
    });

  for (const source of ["Fondo Mutuo", "Pagos en tránsito", "Cuenta puente"])
    test(`permite que ${source} quede sin sugerencia`, () =>
      assert.equal(pipeline.suggest(source, []).decision, "no_candidate"));

  it("no fuerza un ganador cuando el nombre es ambiguo", () => {
    const result = pipeline.suggest("Cuenta general", [
      { id: "a", code: "a", name: "Cuenta activo general" },
      { id: "b", code: "b", name: "Cuenta pasivo general" },
    ]);
    assert.ok(["ambiguous", "no_candidate"].includes(result.decision));
  });
});

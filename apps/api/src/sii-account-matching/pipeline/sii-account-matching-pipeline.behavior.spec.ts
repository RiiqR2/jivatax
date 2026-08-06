import assert from "node:assert/strict";
import { describe, it, test } from "node:test";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";
import { AccountObservationClassifierService } from "./account-observation-classifier.service";
import type { PipelineCatalogAccount } from "./account-matching-pipeline.types";
import { SiiAccountMatchingPipelineService } from "./sii-account-matching-pipeline.service";
import { ExactMappingResolverService } from "./exact-mapping-resolver.service";
import { AccountingRuleResolverService } from "./accounting-rule-resolver.service";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";

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
  const exact = new ExactMappingResolverService(compatibility);

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

  for (const [description, sourceName, destination, overrides] of [
    [
      "temporalidad",
      "Activo corriente",
      "Activo no corriente",
      { temporalClass: "current" as const },
    ],
    [
      "sección",
      "Activo corriente",
      "Pasivo corriente",
      { observedSection: "asset" as const },
    ],
    [
      "naturaleza",
      "Activo corriente",
      "Pasivo corriente",
      { observedSection: "unknown" as const, balanceNature: "debit" as const },
    ],
    [
      "categoría tributaria protegida",
      "Gasto ordinario",
      "Gastos rechazados",
      { specialTaxCategory: "none" as const },
    ],
  ] as const)
    test(`una coincidencia exacta incompatible por ${description} queda excluida`, () => {
      const observation = {
        ...classifier.classify(sourceName),
        ...overrides,
        normalizedName: normalizeAccountTerm(destination),
      };
      const result = exact.resolve(observation, [
        { id: "exact", code: "exact", name: destination },
      ]);
      assert.deepEqual(result, []);
    });

  it("acepta una cuenta correctora con naturaleza acreedora compatible", () => {
    const observation = classifier.classify("Provisión deuda incobrable");
    const result = compatibility.evaluate(
      observation,
      "Provisión deuda incobrable",
    );
    assert.equal(observation.observedSection, "contra_asset");
    assert.equal(observation.balanceNature, "credit");
    assert.equal(result.compatible, true);
  });

  for (const accountName of [
    "Depreciación acumulada maquinarias",
    "Amortización acumulada intangibles",
  ])
    test(`${accountName} se clasifica como correctora acreedora de activo`, () => {
      const observation = classifier.classify(accountName);
      assert.equal(observation.observedSection, "contra_asset");
      assert.equal(observation.contraAccountType, "asset_allowance");
      assert.equal(observation.balanceNature, "credit");
      assert.equal(
        compatibility.evaluate(observation, accountName).compatible,
        true,
      );
      const ordinaryAsset = compatibility.evaluate(observation, "Maquinarias");
      assert.equal(ordinaryAsset.compatible, false);
      assert.ok(
        ordinaryAsset.exclusionReasons.includes("incompatible_balance_nature"),
      );
    });

  it("conserva las naturalezas de cuentas ordinarias conocidas", () => {
    assert.equal(classifier.classify("Maquinarias").balanceNature, "debit");
    assert.equal(
      classifier.classify("Proveedores por pagar").balanceNature,
      "credit",
    );
  });

  it("usa unknown como fallback y no fuerza incompatibilidad de naturaleza", () => {
    const observation = classifier.classify("Cuenta auxiliar genérica");
    assert.equal(observation.balanceNature, "unknown");
    assert.equal(
      compatibility.evaluate(observation, "Obligación financiera").compatible,
      true,
    );
  });

  it("normaliza tildes de igual forma en clasificación, reglas y exact match", () => {
    const observation = classifier.classify("OBLIGACIÓN BANCARIA");
    assert.equal(observation.normalizedName, "obligacion bancaria");
    const accentedCatalog = [
      { id: "bank", code: "bank", name: "Obligaciones con BÁNCOS" },
      { id: "vat", code: "vat", name: "IVA CRÉDITO FISCAL" },
    ];
    assert.equal(
      new AccountingRuleResolverService(compatibility).resolve(
        observation,
        accentedCatalog,
      )[0].siiAccountId,
      "bank",
    );
    assert.equal(
      exact.resolve(
        classifier.classify("iva crédito fiscal"),
        accentedCatalog,
      )[0].siiAccountId,
      "vat",
    );
  });

  for (const [source, destination] of [
    ["Cheque por cobrar", "Valores negociables"],
    ["Deudores cobranza judicial", "Valores negociables"],
    ["Pagaré por cobrar", "Valores negociables"],
    ["Garantía entregada", "Valores negociables"],
    ["Préstamo por cobrar", "Cuenta por pagar"],
    ["Préstamo por pagar", "Cuenta por cobrar"],
    ["Gasto legal", "Gastos rechazados"],
    ["Gasto notarial", "Gastos no documentados"],
    ["Habilitación de local", "Gastos por donaciones rechazadas"],
    ["Gasto común local", "Gasto común de renta extranjera"],
    ["Cuenta puente", "Cuenta específica comercial"],
  ])
    test(`Bloque 3 excluye ${source} → ${destination}`, () =>
      assert.equal(
        compatibility.evaluate(
          classifier.classify(source),
          classifier.classify(destination),
        ).compatible,
        false,
      ));

  for (const [source, destination] of [
    ["Cheque por cobrar", "Cuentas por cobrar"],
    ["Pagaré por cobrar", "Documentos por cobrar"],
    ["Garantía entregada", "Garantías y depósitos"],
    ["Gasto ordinario", "Gasto ordinario"],
  ])
    test(`Bloque 3 conserva ${source} → ${destination}`, () =>
      assert.equal(
        compatibility.evaluate(
          classifier.classify(source),
          classifier.classify(destination),
        ).compatible,
        true,
      ));

  it("una fuente relacionada frente a destino sin relación queda incierta", () => {
    const result = compatibility.evaluate(
      classifier.classify("Cuenta por cobrar relacionada"),
      classifier.classify("Cuenta por cobrar"),
    );
    assert.equal(result.compatible, true);
    assert.equal(result.compatibilityLevel, "uncertain");
    assert.ok(
      result.warnings.includes(
        "related_source_destination_relation_unspecified",
      ),
    );
  });

  it("rechaza metadata oficial de nodos agrupadores e inactivos", () => {
    const source = classifier.classify("Caja");
    const grouped = compatibility.evaluateCatalog(source, {
      id: "group",
      code: "1",
      name: "Disponible",
      isLeaf: false,
    });
    const inactive = compatibility.evaluateCatalog(source, {
      id: "inactive",
      code: "2",
      name: "Disponible",
      active: false,
    });
    assert.ok(grouped.exclusionReasons.includes("destination_grouping_node"));
    assert.ok(inactive.exclusionReasons.includes("destination_inactive"));
  });

  it("sin temporalidad conserva ambos plazos con warning", () => {
    const source = classifier.classify("Activo ordinario");
    for (const destination of ["Activo corriente", "Activo no corriente"]) {
      const result = compatibility.evaluate(source, destination);
      assert.equal(result.compatible, true);
      assert.ok(result.warnings.includes("temporal_class_undetermined"));
    }
  });
});

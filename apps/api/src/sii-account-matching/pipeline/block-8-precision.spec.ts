import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";
import { AccountObservationClassifierService } from "./account-observation-classifier.service";
import { SiiAccountMatchingPipelineService } from "./sii-account-matching-pipeline.service";
import type { PipelineCatalogAccount } from "./account-matching-pipeline.types";

const classifier = new AccountObservationClassifierService();
const compatibility = new AccountCompatibilityFilterService();
const pipeline = new SiiAccountMatchingPipelineService();
const account = (
  id: string,
  code: string,
  name: string,
  parentCode?: string,
): PipelineCatalogAccount => ({ id, code, name, parentCode });

describe("Bloque 8 - barreras de precisión", () => {
  for (const [source, destination] of [
    ["Interés financiero por leasing", "Pérdida Tributaria de Arrastre"],
    ["Gastos Legales", "Gastos Anticipados"],
    ["Gastos Comunes", "Gastos pagados por anticipado"],
    ["Honorarios Auditoría", "Pérdida Tributaria de Arrastre"],
    ["Cuentas por cobrar Rel", "Otros pasivos financieros"],
    ["Préstamos por cobrar NC", "Otros pasivos financieros corrientes"],
    ["Interés préstamos por cobrar NC", "Gastos pagados por anticipado"],
    ["Pasivos por Impuestos Diferidos", "Impuestos por recuperar"],
    ["Resultado Acumulado", "Resultado de Explotación"],
  ])
    it(`excluye ${source} → ${destination}`, () => {
      const result = compatibility.evaluate(
        classifier.classify(source),
        classifier.classify(destination),
      );
      assert.equal(result.compatible, false, result.exclusionReasons.join(","));
    });

  for (const value of [
    "Préstamos por cobrar Rel, no corrientes",
    "Interés préstamos por cobrar, NC",
    "Obligaciones con Bancos, no corriente",
  ])
    it(`detecta plazo no corriente: ${value}`, () =>
      assert.equal(classifier.classify(value).temporalClass, "non_current"));

  it("deriva hojas desde hijos activos y nunca gana el agrupador", () => {
    const catalog = [
      account("assets", "1.00.00.00", "ACTIVOS"),
      account("available", "1.01.01.00", "Disponible", "1.00.00.00"),
    ];
    const result = pipeline.resolve({
      companyId: "company",
      companyAccountId: "source",
      accountObservation: {
        accountCode: "1",
        accountName: "Caja",
        assetAmount: "1",
      },
      historicalCompanyMappings: [],
      companyAliases: [],
      catalogTerms: [],
      catalogAccounts: catalog,
    });
    assert.equal(result.candidates[0]?.siiAccountId, "available");
    assert.ok(result.warnings.includes("catalog_grouping_nodes_excluded"));
  });

  it("token overlap sin evidencia contable no crea candidato", () => {
    const result = pipeline.resolve({
      companyId: "company",
      companyAccountId: "source",
      accountObservation: {
        accountCode: "x",
        accountName: "Experiencia carbono",
      },
      historicalCompanyMappings: [],
      companyAliases: [],
      catalogTerms: [],
      catalogAccounts: [account("x", "9", "Experiencia acumulada")],
    });
    assert.equal(result.decision, "no_candidate");
  });

  it("impuesto diferido sin dirección acepta destinos tributarios como inciertos", () => {
    const source = classifier.classify("Impuestos diferidos");
    assert.equal(source.specialTaxCategory, "deferred_tax_unspecified");
    assert.equal(source.observedSection, "unknown");
    for (const destination of [
      "Activo por impuestos diferidos",
      "Pasivo por impuestos diferidos",
    ]) {
      const result = compatibility.evaluate(
        source,
        classifier.classify(destination),
      );
      assert.equal(result.compatible, true);
      assert.equal(result.compatibilityLevel, "uncertain");
      assert.ok(result.warnings.includes("deferred_tax_direction_unspecified"));
    }
    assert.equal(
      compatibility.evaluate(source, classifier.classify("Gastos Diferidos"))
        .compatible,
      false,
    );
  });

  it("el Balance determina activo o pasivo por impuestos diferidos", () => {
    const asset = classifier.classify({
      accountCode: "tax-a",
      accountName: "Impuestos diferidos",
      assetAmount: "1",
    });
    const liability = classifier.classify({
      accountCode: "tax-l",
      accountName: "Impuestos diferidos",
      liabilityAmount: "1",
    });
    assert.deepEqual(
      [asset.observedSection, asset.specialTaxCategory],
      ["asset", "deferred_tax_asset"],
    );
    assert.deepEqual(
      [liability.observedSection, liability.specialTaxCategory],
      ["liability", "deferred_tax_liability"],
    );
  });

  it("mantiene separadas las categorías protegidas de IVA", () => {
    const credit = classifier.classify("IVA Crédito Fiscal");
    const debit = classifier.classify("IVA Débito Fiscal");
    assert.equal(compatibility.evaluate(credit, credit).compatible, true);
    assert.equal(compatibility.evaluate(debit, debit).compatible, true);
    assert.equal(compatibility.evaluate(credit, debit).compatible, false);
    assert.equal(compatibility.evaluate(debit, credit).compatible, false);
  });
});

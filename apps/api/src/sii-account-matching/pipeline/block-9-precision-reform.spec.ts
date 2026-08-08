import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountObservationClassifierService } from "./account-observation-classifier.service";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";
import { CompatibleCandidateRankerService } from "./compatible-candidate-ranker.service";
import { SiiAccountMatchingPipelineService } from "./sii-account-matching-pipeline.service";
import type {
  MatchingResolutionContext,
  PipelineCatalogAccount,
} from "./account-matching-pipeline.types";

/**
 * Regression coverage grounded in the real 134-account Balance evaluation
 * (`tmp/account-matching-evaluation/report.txt`). Each case reproduces a
 * concrete pattern the report showed repeatedly, not a single account name.
 */
describe("Bloque 9 - reforma de precisión (evidencia del reporte real)", () => {
  const classifier = new AccountObservationClassifierService();
  const compatibility = new AccountCompatibilityFilterService(classifier);
  const ranker = new CompatibleCandidateRankerService(compatibility);
  const pipeline = new SiiAccountMatchingPipelineService();

  function context(
    name: string,
    catalogAccounts: PipelineCatalogAccount[],
  ): MatchingResolutionContext {
    return {
      companyId: "company",
      companyAccountId: "internal",
      accountObservation: { accountCode: "x", accountName: name },
      historicalCompanyMappings: [],
      companyAliases: [],
      catalogTerms: [],
      catalogAccounts,
    };
  }

  it("la jerarquía del código SII prevalece sobre el nombre para un activo con prefijo de gasto", () => {
    // Real case: "Gastos Diferidos" is 1.03.32.00, a non-current asset, but
    // reads lexically like an expense. `evaluateCatalog` is the only caller
    // that computes this hint, and only for a real catalogue account.
    const destination = classifier.classify(
      { accountCode: "1.03.32.00", accountName: "Gastos Diferidos" },
      { catalogHierarchySection: "asset" },
    );
    assert.equal(destination.observedSection, "asset");
    assert.ok(
      destination.classificationEvidence.includes("catalog_chapter:asset"),
    );
  });

  it("evaluateCatalog aplica la jerarquía real por código de catálogo sin heurística adicional", () => {
    const source = classifier.classify("Gasto operativo genérico");
    const result = compatibility.evaluateCatalog(source, {
      id: "deferred-charges",
      code: "1.03.32.00",
      name: "Gastos Diferidos",
      isLeaf: true,
    });
    // The destination is now classified as an asset (chapter 1), so a
    // generic expense source is excluded by section, not accepted by a
    // lexical "gasto" coincidence.
    assert.equal(result.compatible, false);
    assert.ok(
      result.exclusionReasons.includes("incompatible_statement_section"),
    );
  });

  it("el capítulo 5 (conciliación tributaria RLI) nunca gana por solapamiento léxico", () => {
    const source = classifier.classify("Interes préstamos por cobrar, NC");
    const catalog: PipelineCatalogAccount[] = [
      {
        id: "rli",
        code: "5.01.04.98",
        name: "Otros agregados al resultado tributario por inventarios",
        isLeaf: true,
      },
    ];
    assert.deepEqual(ranker.rank(source, catalog), []);
  });

  it("una cuenta curada como residual sólo se alcanza con evidencia exacta, nunca por ranking", () => {
    const source = classifier.classify(
      "Préstamos por cobrar Rel, no corrientes",
    );
    const catalog: PipelineCatalogAccount[] = [
      {
        id: "residual",
        code: "1.03.99.00",
        name: "Otros Activos No Corrientes",
        isLeaf: true,
        knowledge: { isResidual: true },
      },
    ];
    assert.deepEqual(ranker.rank(source, catalog), []);
  });

  it("el conocimiento curado de sii_account_knowledge prevalece sobre la heurística léxica del nombre", () => {
    const observation = classifier.classify(
      { accountCode: "9.00.00.00", accountName: "Cargos por servicios varios" },
      {
        catalogKnowledge: {
          statementSection: "asset",
          balanceNature: "debit",
          isCurrent: true,
        },
      },
    );
    assert.equal(observation.observedSection, "asset");
    assert.equal(observation.balanceNature, "debit");
    assert.equal(observation.temporalClass, "current");
    assert.ok(
      observation.classificationEvidence.includes("catalog_knowledge:asset"),
    );
  });

  it("un candidato ranked claramente superior ya no queda forzado a ambiguous", () => {
    const result = pipeline.resolve(
      context("Gastos comunes edificio", [
        {
          id: "strong-match",
          code: "3.01.03.00",
          name: "Gastos de administración y ventas comunes",
          isLeaf: true,
        },
        {
          id: "weak-overlap",
          code: "3.01.03.01",
          name: "Gastos de arriendo",
          isLeaf: true,
        },
      ]),
    );
    assert.notEqual(result.decision, "ambiguous");
    assert.equal(result.candidates[0]?.siiAccountId, "strong-match");
  });

  it("un gasto operativo típico ya no gana por una cuenta de activo mal clasificada por el nombre", () => {
    // Reproduces the "Gastos Diferidos" magnet: several unrelated operating
    // expenses (rent, legal fees, notary fees, utilities...) used to resolve
    // into a non-current asset just because both mention "gasto(s)".
    const result = pipeline.resolve(
      context("Gastos Legales", [
        {
          id: "wrong-asset",
          code: "1.03.32.00",
          name: "Gastos Diferidos",
          isLeaf: true,
        },
        {
          id: "correct-expense",
          code: "3.01.03.00",
          name: "Gastos de administración y ventas",
          isLeaf: true,
        },
      ]),
    );
    assert.notEqual(result.candidates[0]?.siiAccountId, "wrong-asset");
  });
});

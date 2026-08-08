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
 * False-positive regressions grounded in the real 134-account Balance
 * evaluation. Catalogues use official SII codes/names from the imported
 * Balance Tributario 8 Columnas — not empty catalogs or invented codes.
 */
describe("Bloque 10 - falsos positivos del reporte real", () => {
  const classifier = new AccountObservationClassifierService();
  const compatibility = new AccountCompatibilityFilterService(classifier);
  const ranker = new CompatibleCandidateRankerService(compatibility);
  const pipeline = new SiiAccountMatchingPipelineService();

  const catalog: PipelineCatalogAccount[] = [
    {
      id: "lease-option-fund",
      code: "2.01.08.00",
      name: "Fondo Opcion de Compra por Pagar (Leasing)",
      isLeaf: true,
    },
    {
      id: "lease-receivable",
      code: "1.01.21.00",
      name: "Deudores por Leasing",
      isLeaf: true,
    },
    {
      id: "trade-receivable",
      code: "1.01.20.00",
      name: "Deudores por venta, neto (excluye deudores por leasing)",
      isLeaf: true,
    },
    {
      id: "employee-loans",
      code: "1.03.24.00",
      name: "Anticipo y préstamos a los empleados",
      isLeaf: true,
    },
    {
      id: "other-nc-assets",
      code: "1.03.99.00",
      name: "Otros Activos No Corrientes",
      isLeaf: true,
    },
    {
      id: "other-c-assets",
      code: "1.01.99.00",
      name: "Otros activos corrientes",
      isLeaf: true,
    },
    {
      id: "accounts-payable",
      code: "2.01.10.00",
      name: "Cuentas por pagar",
      isLeaf: true,
    },
    {
      id: "other-nc-liab",
      code: "2.02.99.00",
      name: "Otros pasivos NO Corrientes",
      isLeaf: true,
    },
    {
      id: "order-liab",
      code: "2.02.98.00",
      name: "Cuentas de Orden de Pasivos",
      isLeaf: true,
    },
    {
      id: "fixed-asset-disposal",
      code: "3.05.08.00",
      name: "Resultado enajenación Activo Fijo",
      isLeaf: true,
    },
    {
      id: "admin-expense",
      code: "3.01.03.00",
      name: "Gastos de administración y ventas",
      isLeaf: true,
    },
    {
      id: "notes-receivable",
      code: "1.01.25.00",
      name: "Documentos por cobrar",
      isLeaf: true,
    },
  ];

  function context(
    name: string,
    amounts: Partial<{
      assetAmount: string;
      liabilityAmount: string;
      debitBalance: string;
      creditBalance: string;
      lossAmount: string;
      gainAmount: string;
    }> = {},
  ): MatchingResolutionContext {
    return {
      companyId: "company",
      companyAccountId: "internal",
      accountObservation: {
        accountCode: "x",
        accountName: name,
        ...amounts,
      },
      historicalCompanyMappings: [],
      companyAliases: [],
      catalogTerms: [],
      catalogAccounts: catalog,
    };
  }

  it("capítulo 3 no se clasifica como activo por mencionar 'activo fijo' en el nombre", () => {
    const destination = classifier.classify(
      {
        accountCode: "3.05.08.00",
        accountName: "Resultado enajenación Activo Fijo",
      },
      { catalogResultChapter: true },
    );
    assert.notEqual(destination.observedSection, "asset");
  });

  it("un deudor de activo no resuelve a un resultado de enajenación de activo fijo", () => {
    const source = classifier.classify({
      accountCode: "1140700001",
      accountName: "Deudor Arriendo Fijo Y Gasto Común",
      assetAmount: "1",
      debitBalance: "1",
    });
    const result = compatibility.evaluateCatalog(source, {
      id: "fixed-asset-disposal",
      code: "3.05.08.00",
      name: "Resultado enajenación Activo Fijo",
      isLeaf: true,
    });
    assert.equal(result.compatible, false);
    assert.ok(
      result.exclusionReasons.includes("incompatible_statement_section"),
    );
  });

  it("fondo mutuo no gana por la palabra 'fondo' frente a un fondo de leasing por pagar", () => {
    const result = pipeline.resolve(
      context("Fondo Mutuo", {
        // Real Balance columns for this account were liability/credit; the
        // motor must still refuse the leasing-option fund as a destination.
        liabilityAmount: "1",
        creditBalance: "1",
      }),
    );
    assert.notEqual(result.candidates[0]?.siiAccountId, "lease-option-fund");
    assert.equal(result.decision, "no_candidate");
  });

  it("deudores cobranza judicial no resuelven a deudores por leasing ni a deudores varios", () => {
    const result = pipeline.resolve(
      context("Deudores Cobranza Judicial", {
        assetAmount: "1",
        debitBalance: "1",
      }),
    );
    assert.notEqual(result.candidates[0]?.siiAccountId, "lease-receivable");
    assert.notEqual(result.candidates[0]?.siiAccountId, "trade-receivable");
    assert.equal(result.decision, "no_candidate");
  });

  it("arriendo fijo (ingreso) no resuelve a resultado de enajenación de activo fijo", () => {
    const result = pipeline.resolve(
      context("Arriendo Fijo Oficinas", {
        gainAmount: "1",
        creditBalance: "1",
      }),
    );
    assert.notEqual(result.candidates[0]?.siiAccountId, "fixed-asset-disposal");
    assert.equal(result.decision, "no_candidate");
  });

  it("interés de préstamos por cobrar no resuelve a préstamos a empleados", () => {
    const result = pipeline.resolve(
      context("Interes préstamos por cobrar, NC", {
        assetAmount: "1",
        debitBalance: "1",
      }),
    );
    assert.notEqual(result.candidates[0]?.siiAccountId, "employee-loans");
    assert.equal(result.decision, "no_candidate");
  });

  it("préstamos por pagar relacionados no caen en cuentas por pagar genéricas", () => {
    const result = pipeline.resolve(
      context("Préstamos por pagar Rel, no corrientes", {
        liabilityAmount: "1",
        creditBalance: "1",
      }),
    );
    assert.equal(result.decision, "no_candidate");
    assert.deepEqual(
      result.candidates.map((c) => c.siiAccountId),
      [],
    );
  });

  it("cuentas por cobrar relacionadas no caen en residuales 'Otros activos'", () => {
    const result = pipeline.resolve(
      context("Cuentas por cobrar Rel, corrientes", {
        assetAmount: "1",
        debitBalance: "1",
      }),
    );
    assert.notEqual(result.candidates[0]?.siiAccountId, "other-c-assets");
    assert.equal(result.decision, "no_candidate");
  });

  it("cuentas residuales 'Otros ...' nunca ganan por ranking", () => {
    const source = classifier.classify({
      accountCode: "x",
      accountName: "Activo misceláneo no corriente",
      assetAmount: "1",
      debitBalance: "1",
    });
    assert.deepEqual(
      ranker.rank(source, [
        {
          id: "residual",
          code: "1.03.99.00",
          name: "Otros Activos No Corrientes",
          isLeaf: true,
        },
      ]),
      [],
    );
  });

  it("cuentas de orden no ganan por ranking frente a un pasivo de arrendamiento", () => {
    const result = pipeline.resolve(
      context("Pasivos Por Arrendamientos, No Corrientes", {
        liabilityAmount: "1",
        creditBalance: "1",
      }),
    );
    assert.notEqual(result.candidates[0]?.siiAccountId, "order-liab");
    assert.notEqual(result.candidates[0]?.siiAccountId, "other-nc-liab");
  });

  it("pagaré por cobrar sigue pudiendo resolver a documentos por cobrar vía subfamilia", () => {
    const result = pipeline.resolve(
      context("Pagaré por Cobrar - TRM", {
        assetAmount: "1",
        debitBalance: "1",
      }),
    );
    assert.equal(result.candidates[0]?.siiAccountId, "notes-receivable");
  });
});

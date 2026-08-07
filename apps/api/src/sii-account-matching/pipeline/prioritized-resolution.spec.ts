import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import type {
  MatchingResolutionContext,
  PipelineCatalogAccount,
} from "./account-matching-pipeline.types";
import { AccountCompatibilityFilterService } from "./account-compatibility-filter.service";
import { AccountObservationClassifierService } from "./account-observation-classifier.service";
import { SiiAccountMatchingPipelineService } from "./sii-account-matching-pipeline.service";

const accounts: PipelineCatalogAccount[] = [
  {
    id: "cash",
    code: "1101",
    name: "Disponible",
    active: true,
    isLeaf: true,
    mappable: true,
  },
  {
    id: "receivable",
    code: "1201",
    name: "Cuentas por cobrar",
    active: true,
    isLeaf: true,
    mappable: true,
  },
  {
    id: "receivable-other",
    code: "1203",
    name: "Cuenta por cobrar",
    active: true,
    isLeaf: true,
    mappable: true,
  },
  {
    id: "old-current",
    code: "1202",
    name: "Préstamos por cobrar",
    active: true,
    isLeaf: true,
    mappable: true,
  },
  {
    id: "securities",
    code: "1301",
    name: "Valores negociables",
    active: true,
    isLeaf: true,
    mappable: true,
  },
  {
    id: "group",
    code: "1",
    name: "Activo",
    active: true,
    isLeaf: false,
    mappable: true,
  },
];

function context(
  name: string,
  overrides: Partial<MatchingResolutionContext> = {},
): MatchingResolutionContext {
  return {
    companyId: "company",
    companyAccountId: "internal",
    accountObservation: { accountCode: "x", accountName: name },
    historicalCompanyMappings: [],
    companyAliases: [],
    catalogTerms: [],
    catalogAccounts: accounts,
    ...overrides,
  };
}

describe("pipeline v2 - resolución determinística priorizada", () => {
  const pipeline = new SiiAccountMatchingPipelineService();

  it("reutiliza el mapping actual y no deja que alias o ranking lo reemplacen", () => {
    const result = pipeline.resolve(
      context("Cuenta auxiliar", {
        confirmedMapping: {
          companyAccountId: "internal",
          siiAccountId: "cash",
          siiCode: "1101",
          siiName: "Disponible",
          source: "manual",
        },
        companyAliases: [
          {
            normalizedTerm: "cuenta auxiliar",
            siiAccountId: "receivable",
            siiCode: "1201",
            siiName: "Cuentas por cobrar",
            active: true,
          },
        ],
      }),
    );
    assert.equal(result.candidates[0].resolutionType, "confirmed_mapping");
    assert.equal(result.candidates[0].siiAccountId, "cash");
    assert.equal(result.candidates[0].reviewRequired, false);
    assert.equal(result.candidates[0].reusedConfirmedMapping, true);
    assert.equal(result.resolutionStatus, "resolved");
    assert.equal(result.autoConfirmed, false);
  });

  it("remapea y reutiliza un mapping confirmado con código estable único", () => {
    const result = pipeline.resolve(
      context("Nombre cambiado", {
        confirmedMapping: {
          companyAccountId: "internal",
          siiAccountId: "old-uuid",
          siiCode: "1202",
          siiName: "Nombre histórico",
          source: "manual",
        },
      }),
    );
    assert.equal(result.resolutionStatus, "resolved");
    assert.equal(result.candidates[0].siiAccountId, "old-current");
    assert.equal(result.candidates[0].referenceResolution, "remapped");
    assert.equal(result.candidates[0].reusedConfirmedMapping, true);
    assert.equal(result.autoConfirmed, false);
  });

  it("bloquea un confirmado con código inexistente y no cae a alias", () => {
    const result = pipeline.resolve(
      context("Cuenta auxiliar", {
        confirmedMapping: {
          companyAccountId: "internal",
          siiAccountId: "old-uuid",
          siiCode: "missing",
          siiName: "Cuenta histórica",
          source: "manual",
        },
        companyAliases: [
          {
            normalizedTerm: "cuenta auxiliar",
            siiAccountId: "cash",
            siiCode: "1101",
            siiName: "Disponible",
            active: true,
          },
        ],
      }),
    );
    assert.equal(result.resolutionStatus, "confirmed_mapping_unresolved");
    assert.equal(result.decision, "ambiguous");
    assert.deepEqual(result.candidates, []);
    assert.deepEqual(result.warnings, [
      "confirmed_mapping_requires_manual_resolution",
    ]);
    assert.equal(result.unresolvedConfirmedMapping?.siiAccountId, "old-uuid");
    assert.equal(result.autoConfirmed, false);
  });

  it("bloquea un código confirmado ambiguo y no cae a ranking", () => {
    const result = pipeline.resolve(
      context("Cuenta general", {
        confirmedMapping: {
          companyAccountId: "internal",
          siiAccountId: "old-uuid",
          siiCode: "1201",
          siiName: "Cuenta histórica",
          source: "manual",
        },
        catalogAccounts: [
          ...accounts,
          {
            id: "duplicate-code",
            code: "1201",
            name: "Otra cuenta por cobrar",
            active: true,
            isLeaf: true,
            mappable: true,
          },
        ],
      }),
    );
    assert.equal(result.resolutionStatus, "confirmed_mapping_unresolved");
    assert.deepEqual(result.candidates, []);
  });

  it("reutiliza un confirmado aunque el contexto actual parezca incompatible", () => {
    const result = pipeline.resolve(
      context("Pasivo corriente", {
        confirmedMapping: {
          companyAccountId: "internal",
          siiAccountId: "cash",
          siiCode: "1101",
          siiName: "Disponible",
          source: "manual",
        },
      }),
    );
    assert.equal(result.candidates[0].resolutionType, "confirmed_mapping");
    assert.equal(result.candidates[0].siiAccountId, "cash");
  });

  it("prioriza historial de la misma cuenta sobre términos globales", () => {
    const result = pipeline.resolve(
      context("Cuentas por cobrar", {
        historicalCompanyMappings: [
          {
            companyAccountId: "internal",
            siiAccountId: "receivable",
            siiCode: "1201",
            siiName: "Cuentas por cobrar",
            source: "history",
          },
        ],
        catalogTerms: [
          {
            normalizedTerm: "cuentas por cobrar",
            type: "expert_alias",
            scope: "global",
            siiAccountId: "cash",
            siiCode: "1101",
            siiName: "Disponible",
            active: true,
          },
        ],
      }),
    );
    assert.equal(
      result.candidates[0].resolutionType,
      "historical_company_mapping",
    );
  });

  it("ignora aliases inactivos, agrupadores e incompatibles", () => {
    for (const alias of [
      {
        normalizedTerm: "cuentas por cobrar",
        siiAccountId: "cash",
        siiCode: "1101",
        siiName: "Disponible",
        active: false,
      },
      {
        normalizedTerm: "cuentas por cobrar",
        siiAccountId: "group",
        siiCode: "1",
        siiName: "Activo",
        active: true,
      },
      {
        normalizedTerm: "cuentas por cobrar",
        siiAccountId: "cash",
        siiCode: "1101",
        siiName: "Disponible",
        active: true,
      },
    ]) {
      const result = pipeline.resolve(
        context("Cuentas por cobrar", { companyAliases: [alias] }),
      );
      assert.notEqual(result.candidates[0]?.resolutionType, "company_alias");
    }
  });

  it("un nombre oficial exacto compatible es fuerte", () => {
    const result = pipeline.resolve(context("Disponible"));
    assert.equal(result.candidates[0].resolutionType, "exact_official_name");
    assert.equal(result.candidates[0].recommendationLevel, "strong");
    assert.equal(result.autoConfirmed, false);
  });

  it("un término negativo no resuelve", () => {
    const result = pipeline.resolve(
      context("Cuenta misteriosa", {
        catalogTerms: [
          {
            normalizedTerm: "cuenta misteriosa",
            type: "negative_term",
            scope: "global",
            siiAccountId: "cash",
            siiCode: "1101",
            siiName: "Disponible",
            active: true,
          },
        ],
        catalogAccounts: [],
      }),
    );
    assert.equal(result.decision, "no_candidate");
  });

  it("dos aliases del mismo nivel y distinto destino son ambiguos", () => {
    const normalizedTerm = normalizeAccountTerm("Cuenta por cobrar");
    const result = pipeline.resolve(
      context("Cuenta por cobrar", {
        companyAliases: [
          {
            normalizedTerm,
            siiAccountId: "receivable",
            siiCode: "1201",
            siiName: "Cuentas por cobrar",
            active: true,
          },
          {
            normalizedTerm,
            siiAccountId: "receivable-other",
            siiCode: "1203",
            siiName: "Cuenta por cobrar",
            active: true,
          },
        ],
      }),
    );
    assert.equal(result.decision, "ambiguous");
    assert.equal(result.candidates.length, 2);
  });

  it("remapea UUID antiguo sólo por código estable inequívoco", () => {
    const mapping = {
      companyAccountId: "internal",
      siiAccountId: "old-id",
      siiCode: "1202",
      siiName: "Préstamos por cobrar",
      source: "history",
    };
    const remapped = pipeline.resolve(
      context("Préstamos por cobrar", { historicalCompanyMappings: [mapping] }),
    );
    assert.equal(remapped.candidates[0].referenceResolution, "remapped");
    assert.equal(remapped.candidates[0].originalSiiAccountId, "old-id");
    assert.equal(remapped.candidates[0].resolvedSiiAccountId, "old-current");
    const unresolved = pipeline.resolve(
      context("Préstamos por cobrar", {
        historicalCompanyMappings: [{ ...mapping, siiCode: "missing" }],
        catalogAccounts: [],
      }),
    );
    assert.equal(unresolved.decision, "no_candidate");
  });

  it("préstamos por cobrar, relacionados e intereses no compiten con valores negociables", () => {
    const classifier = new AccountObservationClassifierService();
    const filter = new AccountCompatibilityFilterService(classifier);
    for (const name of [
      "Préstamo por cobrar",
      "Préstamo por cobrar relacionado",
      "Intereses de préstamo por cobrar",
    ])
      assert.equal(
        filter.evaluate(classifier.classify(name), "Valores negociables")
          .compatible,
        false,
      );
  });
});

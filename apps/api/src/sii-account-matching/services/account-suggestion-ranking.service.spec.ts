import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { accountMatchingMetrics } from "../metrics/account-matching-metrics";
import { accountingMetadata } from "../metadata/accounting-metadata";
import { AccountAttributeParserService } from "./account-attribute-parser.service";
import { AccountCandidateGeneratorService } from "./account-candidate-generator.service";
import { AccountSuggestionRankingService } from "./account-suggestion-ranking.service";
import type { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";

const account = (id: string, code: string, name: string) =>
  ({ id, code, name, deletedAt: null }) as SiiAccountEntity;
const context = (
  section: "asset" | "liability" | "expense" | "income",
  nature: "debit" | "credit",
) => ({
  assetAmount: section === "asset" ? "100" : "0",
  liabilityAmount: section === "liability" ? "100" : "0",
  lossAmount: section === "expense" ? "100" : "0",
  gainAmount: section === "income" ? "100" : "0",
  debitBalance: nature === "debit" ? "100" : "0",
  creditBalance: nature === "credit" ? "100" : "0",
});

describe("deterministic candidate retrieval and ranking", () => {
  const catalogue = [
    account("cash", "1", "Disponible caja bancos"),
    account("debt", "2", "Obligaciones bancarias corto plazo"),
    account("dep", "3", "Depreciación acumulada maquinarias"),
    account("asset", "4", "Maquinarias y equipos"),
    account("pay", "5", "Proveedores por pagar"),
    account("income", "6", "Ingresos por ventas"),
  ];
  const generator = new AccountCandidateGeneratorService();
  const ranking = new AccountSuggestionRankingService();

  it("evaluates the full catalogue and always returns Top 5", () => {
    const generated = generator.generate(catalogue, []);
    assert.equal(generated.length, 6);
    assert.equal(
      ranking.rank("cuenta desconocida", generated).candidates.length,
      5,
    );
  });

  it("adds independent Jaccard, trigram and explainability signals", () => {
    const result = ranking.rank(
      "obligacion bancaria corto plazo",
      generator.generate(catalogue, []),
    );
    assert.equal(result.candidates[0].account.id, "debt");
    const signals = result.candidates[0].reasons.map((reason) => reason.signal);
    assert.ok(signals.includes("jaccard"));
    assert.ok(signals.includes("character_trigrams"));
    assert.ok(
      result.candidates.every((candidate) => candidate.reasons.length > 0),
    );
  });

  it("excludes candidates incompatible with the observed Balance section", () => {
    const result = ranking.rank(
      "bancos",
      generator.generate(catalogue, []),
      context("liability", "credit"),
    );
    const debt = result.candidates.find(
      (candidate) => candidate.account.id === "debt",
    )!;
    const cash = result.candidates.find(
      (candidate) => candidate.account.id === "cash",
    );
    assert.ok(debt.reasons.some((reason) => reason.signal === "balance_match"));
    assert.equal(cash, undefined);
  });

  it("extracts families, term and complementary-account attributes", () => {
    const parser = new AccountAttributeParserService();
    assert.deepEqual(
      parser.parse("DEUDAS CON BANCOS CORTO PLAZO").family,
      "financial_liabilities",
    );
    assert.equal(parser.parse("DEUDAS CON BANCOS CORTO PLAZO").term, "current");
    assert.equal(
      parser.parse("DEP ACUM MAQUINARIAS Y EQUIPOS").contraAccount,
      true,
    );
    assert.equal(
      accountingMetadata("DEP ACUM MAQUINARIAS").expectedBalanceNature,
      "credit",
    );
  });

  describe("Balance corto de Limpiesito", () => {
    const shortBalanceCatalogue = [
      account("machinery", "1.02.03.00", "Maquinarias y equipos"),
      account("prepaid", "1.01.11.00", "Gastos pagados por anticipado"),
      account("admin", "expense-real", "Gastos de administración y ventas"),
      account("cost", "cost-real", "Costo de ventas"),
      account("retained", "equity-real", "Pérdidas acumuladas"),
      account("sales", "income-real", "Ingresos por ventas"),
    ];
    const generated = generator.generate(shortBalanceCatalogue, []);

    it("mantiene Maquinaria Industrial en Maquinarias y equipos", () => {
      const result = ranking.rank(
        "Maquinaria Industrial",
        generated,
        context("asset", "debit"),
      );
      assert.equal(result.candidates[0]?.account.code, "1.02.03.00");
    });

    for (const internalName of [
      "Arriendo",
      "Gastos de Honorarios",
      "Electricidad",
    ])
      it(`${internalName} en Pérdidas excluye el activo anticipado`, () => {
        const result = ranking.rank(
          internalName,
          generated,
          context("expense", "debit"),
        );
        assert.equal(
          result.candidates.some((item) => item.account.code === "1.01.11.00"),
          false,
        );
        assert.equal(
          result.candidates[0]?.account.name,
          "Gastos de administración y ventas",
        );
        assert.ok(
          result.candidates[0]?.reasons.some(
            (reason) => reason.signal === "observed_expense_classification",
          ),
        );
      });

    it("permite el activo anticipado solo con señal explícita", () => {
      const result = ranking.rank(
        "Arriendo anticipado",
        generated,
        context("asset", "debit"),
      );
      assert.equal(result.candidates[0]?.account.code, "1.01.11.00");
    });

    it("separa costo de servicios de patrimonio", () => {
      const result = ranking.rank(
        "Costo de Servicios",
        generated,
        context("expense", "debit"),
      );
      assert.equal(result.candidates[0]?.account.name, "Costo de ventas");
      assert.equal(
        result.candidates.some(
          (item) => item.account.name === "Pérdidas acumuladas",
        ),
        false,
      );
    });

    it("separa Ventas de gastos aunque compartan el token ventas", () => {
      const result = ranking.rank(
        "Ventas",
        generated,
        context("income", "credit"),
      );
      assert.equal(result.candidates[0]?.account.name, "Ingresos por ventas");
      assert.equal(
        result.candidates.some(
          (item) => item.account.name === "Gastos de administración y ventas",
        ),
        false,
      );
    });
  });

  it("marks close candidates as ambiguous", () => {
    const twins = [
      account("a", "1", "Banco corriente"),
      account("b", "2", "Banco corriente"),
    ];
    const result = ranking.rank(
      "Banco corriente",
      generator.generate(twins, []),
    );
    assert.equal(result.decision, "ambiguous");
    assert.ok(
      result.candidates[0].reasons.some(
        (reason) => reason.signal === "ambiguous_candidates",
      ),
    );
  });

  it("reports NoCandidate and coverage metrics", () => {
    assert.equal(ranking.rank("caja", []).decision, "no_candidate");
    const metrics = accountMatchingMetrics([
      { expectedSiiAccountId: "a", candidateIds: ["a", "b"], accepted: true },
      {
        expectedSiiAccountId: "c",
        candidateIds: ["b", "d", "c"],
        corrected: true,
        ambiguous: true,
      },
      { candidateIds: [] },
    ]);
    assert.equal(metrics.coverageAt1, 0.5);
    assert.equal(metrics.coverageAt3, 1);
    assert.equal(metrics.noCandidateRate, 1 / 3);
  });

  it("retrieves and explains candidates using curated accounting concepts", () => {
    const concept = (
      siiAccountId: string,
      value: string,
      conceptType: SiiAccountConceptEntity["conceptType"],
    ) =>
      ({
        siiAccountId,
        concept: value,
        normalizedConcept: value,
        conceptType,
        active: true,
        deletedAt: null,
        weight: 90,
      }) as SiiAccountConceptEntity;
    const concepts = [
      concept("debt", "deuda financiera", "economic_concept"),
      concept("debt", "corto plazo", "temporal_classification"),
      concept("dep", "depreciacion acumulada", "economic_concept"),
      concept(
        "dep",
        "cuenta complementaria de activo",
        "contra_account_indicator",
      ),
      concept("cash", "liquidez", "economic_concept"),
    ];
    const bank = ranking.rank(
      "deuda financiera corto plazo",
      generator.generate(catalogue, [], concepts),
    );
    assert.equal(bank.candidates[0].account.id, "debt");
    assert.ok(
      bank.candidates[0].reasons.some(
        (reason) => reason.signal === "exact_concept",
      ),
    );
    assert.ok(
      bank.candidates[0].reasons.some(
        (reason) => reason.signal === "temporal_classification_match",
      ),
    );
    assert.notEqual(bank.candidates[0].account.id, "cash");

    const depreciation = ranking.rank(
      "depreciacion acumulada maquinarias",
      generator.generate(catalogue, [], concepts),
    );
    assert.equal(depreciation.candidates[0].account.id, "dep");
    assert.ok(
      depreciation.candidates[0].reasons.some(
        (reason) => reason.signal === "contra_account_match",
      ),
    );
  });

  it("does not make a generic concept approvable by itself", () => {
    const concepts = [
      {
        siiAccountId: "cash",
        concept: "activo",
        normalizedConcept: "activo",
        conceptType: "statement_section",
        active: true,
        deletedAt: null,
        weight: 100,
      },
    ] as SiiAccountConceptEntity[];
    const result = ranking.rank(
      "activo",
      generator.generate(catalogue, [], concepts),
    );
    assert.equal(result.decision, "review");
    assert.ok(
      !result.candidates[0].reasons.some(
        (reason) => reason.signal === "exact_concept",
      ),
    );
  });
});

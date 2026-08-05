import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { accountMatchingMetrics } from "../metrics/account-matching-metrics";
import { accountingMetadata } from "../metadata/accounting-metadata";
import { AccountAttributeParserService } from "./account-attribute-parser.service";
import { AccountCandidateGeneratorService } from "./account-candidate-generator.service";
import { AccountSuggestionRankingService } from "./account-suggestion-ranking.service";
import type { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import type { AccountMatchingLearningEntity } from "../entities/account-matching-learning.entity";
import type { AccountMatchingLearningIndustryEntity } from "../entities/account-matching-learning-industry.entity";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";

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

  it("evaluates the full catalogue before semantic eligibility", () => {
    const generated = generator.generate(catalogue, []);
    assert.equal(generated.length, 6);
    const result = ranking.rank("cuenta desconocida", generated);
    assert.equal(result.allCandidates.length, 6);
    assert.equal(result.candidates.length, 0);
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

  it("uses the period snapshot as primary name and canonical history only as a secondary signal", () => {
    const result = ranking.rank(
      {
        observedAccountName: "Insumos de Lavandería",
        canonicalAccountName: "Mercaderías",
      },
      generator.generate([
        account("laundry", "3.01.09.00", "Insumos de Lavandería"),
        account("merchandise", "1.01.20.00", "Mercaderías"),
      ]),
    );

    assert.equal(result.candidates[0].account.id, "laundry");
    assert.ok(
      result.allCandidates
        .find((candidate) => candidate.account.id === "merchandise")
        ?.reasons.some((reason) => reason.signal.startsWith("canonical_")),
    );
  });

  it("classifies IVA Crédito Fiscal code 1.01.59.00 as asset and keeps exact learning", () => {
    const iva = account("iva-credit", "1.01.59.00", "IVA Crédito Fiscal");
    const learning = [
      {
        siiAccountId: iva.id,
        normalizedName: "iva credito fiscal",
        normalizedNameHash: "hash",
        confidence: "0.800000",
        confirmationCount: 1,
        deletedAt: null,
      },
    ] as AccountMatchingLearningEntity[];
    const candidate = generator.generate([iva], [], [], [], learning)[0];

    assert.equal(candidate.metadata.statementSection, "asset");
    assert.equal(candidate.metadata.statementSectionSource, "code_hierarchy");
    assert.equal(candidate.metadata.expectedBalanceNature, "debit");
    const result = ranking.rank(
      { observedAccountName: "IVA Crédito Fiscal" },
      [candidate],
      context("asset", "debit"),
    );
    assert.equal(result.candidates[0].account.id, iva.id);
    assert.ok(
      result.candidates[0].reasons.some(
        (reason) => reason.signal === "supervised_learning_global",
      ),
    );
  });

  it("requires semantic evidence for review candidates instead of Balance compatibility alone", () => {
    const result = ranking.rank(
      {
        observedAccountName: "Insumos de Lavandería",
        canonicalAccountName: "Mercaderías",
      },
      generator.generate([
        account("machinery", "1.02.03.00", "Maquinarias y equipos"),
      ]),
      context("asset", "debit"),
    );
    assert.equal(result.decision, "no_candidate");
    assert.equal(result.candidates.length, 0);
    assert.equal(result.allCandidates[0].semanticEvidenceSatisfied, false);
    assert.deepEqual(result.allCandidates[0].semanticEvidenceReasons, []);
  });

  it("accepts specific rules and aliases as semantic review evidence", () => {
    const capital = ranking.rank(
      "Capital Social",
      generator.generate([account("capital", "2.03.01.00", "Capital pagado")]),
      context("liability", "credit"),
    );
    assert.ok(
      capital.candidates[0].semanticEvidenceReasons.includes(
        "rule:capital_is_equity",
      ),
    );
    assert.equal(capital.decision, "review");

    const income = account(
      "operating-income",
      "3.01.01.00",
      "Ingresos de explotación",
    );
    const aliases = [
      {
        siiAccountId: income.id,
        term: "ventas",
        normalizedTerm: "ventas",
        type: "alias",
        scope: "global",
        active: true,
        deletedAt: null,
      },
    ] as SiiAccountTermEntity[];
    const sales = ranking.rank(
      "Ventas Servicios de Lavandería",
      generator.generate([income], aliases),
      context("income", "credit"),
    );
    assert.equal(sales.candidates[0].semanticEvidenceSatisfied, true);
    assert.ok(sales.candidates[0].semanticEvidenceReasons.length > 0);
  });

  it("combines medium lexical and structural evidence without using historical names", () => {
    for (const [observedAccountName, canonicalAccountName, destination] of [
      [
        "Remuneraciones por Pagar",
        "Retenciones Honorarios",
        account("payable", "2.01.08.00", "Cuentas por pagar"),
      ],
      [
        "Costo de Servicios",
        "Costo de Ventas",
        account("cost", "3.01.02.00", "Costos de explotación"),
      ],
    ] as const) {
      const section = observedAccountName.startsWith("Costo")
        ? context("expense", "debit")
        : context("liability", "credit");
      const result = ranking.rank(
        { observedAccountName, canonicalAccountName },
        generator.generate([destination]),
        section,
      );
      assert.equal(result.decision, "review");
      assert.equal(result.candidates[0].semanticEvidenceSatisfied, true);
      assert.equal(result.candidates[0].semanticEvidenceStrong, false);
      assert.ok(result.candidates[0].semanticEvidenceReasons.length > 1);
      assert.ok(
        !result.candidates[0].semanticEvidenceReasons.some((reason) =>
          reason.startsWith("canonical_"),
        ),
      );
    }
  });

  it("excludes candidates incompatible with the observed Balance section", () => {
    const result = ranking.rank(
      "bancos",
      generator.generate(catalogue, []),
      context("liability", "credit"),
    );
    const debt = result.allCandidates.find(
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

  it("does not treat the SII presentation suffix as universal contra-account evidence", () => {
    assert.deepEqual(
      accountingMetadata("Gastos de administración y ventas (menos)"),
      {
        family: "expenses",
        statementSection: "expense",
        expectedBalanceNature: "debit",
        term: undefined,
        contraAccount: false,
        concepts: ["gasto", "administracion", "venta", "meno"],
      },
    );

    const depreciation = accountingMetadata("Depreciación (menos)");
    assert.equal(depreciation.family, "depreciation");
    assert.equal(depreciation.statementSection, "asset");
    assert.equal(depreciation.expectedBalanceNature, "credit");
    assert.equal(depreciation.contraAccount, true);
  });

  describe("Balance corto de Limpiesito", () => {
    const shortBalanceCatalogue = [
      account("machinery", "1.02.03.00", "Maquinarias y equipos"),
      account("prepaid", "1.01.11.00", "Gastos pagados por anticipado"),
      account(
        "admin",
        "3.01.03.00",
        "Gastos de administración y ventas (menos)",
      ),
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
          "Gastos de administración y ventas (menos)",
        );
        assert.equal(result.decision, "automatic");
        assert.ok((result.candidates[0]?.confidence ?? 0) >= 0.55);
        assert.ok(
          result.candidates[0]?.reasons.some((reason) =>
            /^exact_(alias|erp_term|industry_term|manual_term)$/.test(
              reason.signal,
            ),
          ),
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
          (item) =>
            item.account.name === "Gastos de administración y ventas (menos)",
        ),
        false,
      );
    });

    it("mantiene la depreciación acumulada en la cuenta complementaria", () => {
      const depreciationCatalogue = [
        account("dep-contra", "1.02.06.00", "Depreciación (menos)"),
        account("dep-expense", "3.01.04.00", "Gasto por depreciación"),
      ];
      const result = ranking.rank(
        "Depreciación acumulada",
        generator.generate(depreciationCatalogue, []),
        context("asset", "credit"),
      );
      assert.equal(result.candidates[0]?.account.code, "1.02.06.00");
      assert.equal(
        result.candidates.some(
          (candidate) => candidate.account.id === "dep-expense",
        ),
        false,
      );
    });
  });

  it("reports a contra-account mismatch separately from a section mismatch", () => {
    const result = ranking.rank(
      "Gasto",
      generator.generate([
        account("wrong-contra", "x", "Depreciación (menos)"),
      ]),
      context("asset", "debit"),
    );
    assert.deepEqual(result.discardedCandidates[0]?.reasons, [
      "incompatible_contra_account",
    ]);
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

  it("combines global confidence and a smaller industry boost on one candidate", () => {
    const industryEvidence = {
      confirmationCount: 2,
      confidence: "0.500000",
    } as AccountMatchingLearningIndustryEntity;
    const learning = {
      normalizedName: "caja",
      siiAccountId: "cash",
      confirmationCount: 5,
      confidence: "0.500000",
      deletedAt: null,
      industryEvidence,
    } as AccountMatchingLearningEntity & {
      industryEvidence: AccountMatchingLearningIndustryEntity;
    };
    const candidates = generator.generate(catalogue, [], [], [], [learning]);
    const result = ranking.rank("caja", candidates);
    const cash = result.allCandidates.find(
      (item) => item.account.id === "cash",
    );
    const global = cash?.reasons.find(
      (reason) => reason.signal === "supervised_learning_global",
    );
    const industry = cash?.reasons.find(
      (reason) => reason.signal === "supervised_learning_industry",
    );

    assert.equal(
      candidates.filter((item) => item.account.id === "cash").length,
      1,
    );
    assert.equal(global?.points, 15);
    assert.equal(industry?.points, 3.75);
    assert.ok((industry?.points ?? 0) < (global?.points ?? 0));
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
    assert.equal(result.decision, "no_candidate");
    assert.ok(
      result.allCandidates.every(
        (candidate) =>
          !candidate.reasons.some(
            (reason) => reason.signal === "exact_concept",
          ),
      ),
    );
  });

  it("uses differentiated exact weights and historical mapping as strong evidence", () => {
    const industryAlias = [
      {
        siiAccountId: "cash",
        term: "caja chica",
        normalizedTerm: "caja chica",
        type: "industry_term",
        scope: "global",
        active: true,
        deletedAt: null,
        weight: 50,
      },
    ] as SiiAccountTermEntity[];
    const industryMatch = ranking.rank(
      "caja chica",
      generator.generate(
        [account("cash", "1", "Disponible caja bancos")],
        industryAlias,
      ),
    );
    const industryReason = industryMatch.candidates[0].reasons.find(
      (reason) => reason.signal === "exact_industry_term",
    );
    assert.equal(industryReason?.points, 50);

    const historical = ranking.rank(
      "cuenta interna",
      generator.generate(catalogue, []),
      undefined,
      [],
      { historicalCompanyMappingSiiAccountId: "cash" },
    );
    assert.ok(
      historical.allCandidates
        .find((candidate) => candidate.account.id === "cash")
        ?.reasons.some(
          (reason) => reason.signal === "historical_company_mapping",
        ),
    );
  });

  it("penalizes negative terms without removing valid exact matches", () => {
    const terms = [
      {
        siiAccountId: "cash",
        term: "caja",
        normalizedTerm: "caja",
        type: "alias",
        scope: "global",
        active: true,
        deletedAt: null,
        weight: 60,
      },
      {
        siiAccountId: "cash",
        term: "caja chica",
        normalizedTerm: "caja chica",
        type: "negative_term",
        scope: "global",
        active: true,
        deletedAt: null,
        weight: 20,
      },
    ] as SiiAccountTermEntity[];
    const exact = ranking.rank(
      "caja",
      generator.generate(
        [account("cash", "1", "Disponible caja bancos")],
        terms,
      ),
    );
    assert.ok(exact.candidates[0].score >= 45);
    assert.ok(
      !exact.candidates[0].reasons.some(
        (reason) => reason.signal === "negative_term",
      ),
    );

    const penalized = ranking.rank(
      "caja chica",
      generator.generate(
        [account("cash", "1", "Disponible caja bancos")],
        terms,
      ),
    );
    const cash = penalized.allCandidates.find(
      (candidate) => candidate.account.id === "cash",
    );
    assert.ok(
      cash?.reasons.some((reason) => reason.signal === "negative_term"),
    );
    assert.ok((cash?.score ?? 0) < 60);
  });
});

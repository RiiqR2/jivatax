import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import type { DataSource } from "typeorm";
import { CompanyAccountSuggestionStatus } from "../../accounting/entities/company-account-suggestion.entity";
import { CompanyAccountMappingStatus } from "../../company-account-plan/enums/company-account-plan.enums";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import { AccountMatchingLearningEntity } from "../entities/account-matching-learning.entity";
import { AccountMatchingLearningIndustryEntity } from "../entities/account-matching-learning-industry.entity";
import { ACCOUNT_SUGGESTION_CONFIG } from "../account-suggestion.config";
import { AccountCandidateGeneratorService } from "./account-candidate-generator.service";
import { AccountSuggestionRankingService } from "./account-suggestion-ranking.service";
import { AccountSuggestionService } from "./account-suggestion.service";

const companyId = "company-1";
const sii = (id: string, code: string, name: string) =>
  ({ id, code, name, deletedAt: null }) as SiiAccountEntity;
const term = (
  siiAccountId: string,
  value: string,
  type: SiiAccountTermEntity["type"],
  weight: number,
  scope: SiiAccountTermEntity["scope"] = "global",
  owner: string | null = null,
) =>
  ({
    siiAccountId,
    term: value,
    normalizedTerm: normalizeAccountTerm(value),
    type,
    weight,
    scope,
    companyId: owner,
    active: true,
    deletedAt: null,
  }) as SiiAccountTermEntity;

const generator = new AccountCandidateGeneratorService();
const rankingService = new AccountSuggestionRankingService();

function rank(
  name: string,
  accounts: SiiAccountEntity[],
  terms: SiiAccountTermEntity[] = [],
  options?: { historicalCompanyMappingSiiAccountId?: string | null },
) {
  const generated = generator.generate(accounts, terms);
  const result = rankingService.rank(name, generated, undefined, [], options);
  return {
    candidates: result.candidates,
    allCandidates: result.allCandidates,
    decision: result.decision,
    discardReason:
      result.decision === "ambiguous"
        ? ("ambiguous_candidates" as const)
        : undefined,
  };
}

function reasonPoints(
  result: ReturnType<typeof rank>,
  signal: string | RegExp,
) {
  const reasons = result.candidates[0]?.reasons ?? [];
  const match =
    typeof signal === "string"
      ? reasons.find((reason) => reason.signal === signal)
      : reasons.find((reason) => signal.test(reason.signal));
  return match?.points ?? 0;
}

function totalScore(result: ReturnType<typeof rank>) {
  return (result.candidates[0]?.reasons ?? []).reduce(
    (sum, reason) => sum + reason.points,
    0,
  );
}

describe("AccountSuggestionService matching", () => {
  const disponible = sii("available", "1.01.01.00", "Disponible");
  const clientes = sii("receivables", "1.01.05.00", "Deudores por venta");
  const maquinaria = sii("machinery", "1.02.03.00", "Maquinarias y equipos");

  it("normalizes the four verified internal account names identically", () => {
    assert.equal(normalizeAccountTerm("CAJA"), "caja");
    assert.equal(normalizeAccountTerm("BANCOS"), "bancos");
    assert.equal(normalizeAccountTerm("CLIENTES"), "clientes");
    assert.equal(
      normalizeAccountTerm("MAQUINARIAS Y EQUIPOS"),
      "maquinarias y equipos",
    );
  });

  it("separates negative terms in candidate generation", () => {
    const generic = sii("generic", "9.01.01.00", "Cuenta genérica");
    const generated = generator.generate(
      [generic],
      [
        term(generic.id, "caja", "alias", 60),
        term(generic.id, "caja", "negative_term", 10),
      ],
    );
    assert.equal(generated[0].terms.length, 1);
    assert.equal(generated[0].terms[0].type, "alias");
    assert.equal(generated[0].negativeTerms.length, 1);
    assert.equal(generated[0].negativeTerms[0].type, "negative_term");
  });

  it("matches CAJA and BANCOS to Disponible with curated aliases", () => {
    const terms = [
      term(disponible.id, "caja", "alias", 60),
      term(disponible.id, "bancos", "alias", 55),
    ];
    for (const name of ["CAJA", "BANCOS"]) {
      const result = rank(name, [disponible], terms);
      assert.equal(result.candidates[0]?.account.id, disponible.id);
      assert.ok(result.candidates[0].score >= 55);
    }
  });

  it("matches by siiAccountId without requiring the siiAccount relation", () => {
    const caja = term(disponible.id, "caja", "alias", 60);
    caja.siiAccount = undefined as unknown as SiiAccountEntity;

    const result = rank("CAJA", [disponible], [caja]);
    assert.equal(result.candidates[0]?.account.id, disponible.id);
    assert.equal(reasonPoints(result, "exact_alias"), 60);
    assert.equal(reasonPoints(result, "family_match"), 16);
    assert.equal(totalScore(result), 111);
  });

  it("converts a decimal string weight before scoring", () => {
    const caja = term(disponible.id, "caja", "alias", 60);
    caja.weight = "60.00" as unknown as number;

    const result = rank("CAJA", [disponible], [caja]);
    assert.equal(reasonPoints(result, "exact_alias"), 60);
    assert.equal(totalScore(result), 111);
    assert.equal(typeof result.candidates[0]?.score, "number");
  });

  it("uses differentiated weights for erp_term and official_name", () => {
    const clientResult = rank(
      "CLIENTES",
      [clientes],
      [term(clientes.id, "clientes", "erp_term", 60)],
    );
    assert.equal(clientResult.candidates[0]?.account.id, clientes.id);
    assert.equal(reasonPoints(clientResult, "exact_erp_term"), 60);
    assert.equal(reasonPoints(clientResult, "family_match"), 16);
    assert.equal(totalScore(clientResult), 111);
    assert.ok(
      clientResult.candidates[0]?.reasons.some(
        (reason) => reason.signal === "exact_erp_term",
      ),
    );

    const machineryResult = rank(
      "MAQUINARIAS Y EQUIPOS",
      [maquinaria],
      [
        term(maquinaria.id, "maquinarias y equipos", "erp_term", 60),
        term(maquinaria.id, "maquinarias y equipos", "official_name", 45),
      ],
    );
    assert.equal(reasonPoints(machineryResult, "exact_erp_term"), 60);
    assert.equal(reasonPoints(machineryResult, "family_match"), 16);
    assert.ok(reasonPoints(machineryResult, "concept_match") > 0);
    assert.equal(
      machineryResult.candidates[0]?.reasons.filter((reason) =>
        reason.signal.startsWith("exact_"),
      ).length,
      1,
    );
    assert.equal(totalScore(machineryResult), 132);
  });

  it("does not promote a candidate supported only by negative terms", () => {
    const generic = sii("generic", "9.01.01.00", "Cuenta genérica");
    const result = rank(
      "CAJA",
      [generic],
      [term(generic.id, "caja", "negative_term", 60)],
    );
    assert.equal(result.candidates.length, 0);
  });

  it("keeps score and confidence scales coherent", () => {
    assert.ok(ACCOUNT_SUGGESTION_CONFIG.minimumSuggestionScore <= 55);
    const result = rank(
      "BANCOS",
      [disponible],
      [term(disponible.id, "bancos", "alias", 55)],
    );
    assert.equal(reasonPoints(result, "exact_alias"), 60);
    assert.equal(totalScore(result), 111);
    assert.ok(result.candidates[0].confidence >= 0);
    assert.ok(result.candidates[0].confidence <= 1);
  });

  it("penalizes bank debt against Disponible without discarding a better match", () => {
    const deuda = sii(
      "debt",
      "2.01.01.00",
      "Obligaciones bancarias corto plazo",
    );
    const generated = generator.generate(
      [disponible, deuda],
      [
        term(disponible.id, "bancos", "alias", 55),
        term(disponible.id, "deudas con bancos", "negative_term", 50),
      ],
    );
    const result = rankingService.rank(
      "deudas con bancos corto plazo",
      generated,
    );
    const disponibleCandidate = result.allCandidates.find(
      (candidate) => candidate.account.id === disponible.id,
    );
    assert.ok(
      disponibleCandidate?.reasons.some(
        (reason) => reason.signal === "negative_term",
      ),
    );
    assert.notEqual(result.candidates[0]?.account.id, disponible.id);
  });

  it("distinguishes machinery from its accumulated depreciation", () => {
    const depreciation = sii(
      "depreciation",
      "1.02.06.00",
      "Depreciación acumulada (menos)",
    );
    const machineryTerms = [
      term(maquinaria.id, "maquinarias y equipos", "erp_term", 60),
      term(maquinaria.id, "depreciacion acumulada", "negative_term", 60),
      term(depreciation.id, "dep acum maquinarias y equipos", "erp_term", 60),
    ];
    assert.equal(
      rank("MAQUINARIAS Y EQUIPOS", [maquinaria, depreciation], machineryTerms)
        .candidates[0]?.account.id,
      maquinaria.id,
    );
    assert.equal(
      rank(
        "DEP ACUM MAQUINARIAS Y EQUIPOS",
        [maquinaria, depreciation],
        machineryTerms,
      ).candidates[0]?.account.id,
      depreciation.id,
    );
  });

  it("marks candidates with equivalent exact evidence as ambiguous", () => {
    const result = rank(
      "CLIENTES",
      [clientes, sii("documents", "1.01.08.00", "Documentos por cobrar")],
      [
        term(clientes.id, "clientes", "alias", 60),
        term("documents", "clientes", "manual_term", 60),
      ],
    );
    assert.equal(result.decision, "ambiguous");
    assert.equal(result.discardReason, "ambiguous_candidates");
    assert.equal(reasonPoints(result, "exact_alias"), 60);
    assert.equal(reasonPoints(result, "family_match"), 16);
    assert.equal(totalScore(result), 111);
    const documents = result.allCandidates.find(
      (candidate) => candidate.account.id === "documents",
    );
    assert.equal(
      documents?.reasons.find((reason) => reason.signal === "exact_manual_term")
        ?.points,
      ACCOUNT_SUGGESTION_CONFIG.weights.exactManualTerm,
    );
    assert.equal(documents?.score, 106);
    assert.ok((result.candidates[0]?.score ?? 0) - (documents?.score ?? 0) < 8);
    assert.equal(
      result.candidates[0].reasons.at(-1)?.signal,
      "ambiguous_candidates",
    );
  });
});

describe("AccountSuggestionService persistence", () => {
  it("persists the three Limpiesito expenses against the real SII (menos) account", async () => {
    const saved: Array<Record<string, unknown>> = [];
    const repository = {
      update: async () => undefined,
      create: (value: Record<string, unknown>) => value,
      save: async (values: Array<Record<string, unknown>>) => {
        saved.push(...values);
        return values;
      },
    };
    const dataSource = {
      transaction: async (
        callback: (manager: {
          getRepository: () => typeof repository;
        }) => unknown,
      ) => callback({ getRepository: () => repository }),
      getRepository: () => ({
        createQueryBuilder: () => ({
          where: () => ({
            andWhere: () => ({
              andWhere: () => ({
                orderBy: () => ({ getMany: async () => [] }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as DataSource;
    const expense = sii(
      "admin-expense",
      "3.01.03.00",
      "Gastos de administración y ventas (menos)",
    );
    const internalAccounts = [
      ["expense-rent", "5.1.03.01", "Arriendo"],
      ["expense-fees", "5.1.04.01", "Gastos de Honorarios"],
      ["expense-electricity", "5.1.05.01", "Electricidad"],
    ].map(([id, internalCode, name]) => ({
      id,
      internalCode,
      name,
      matchingContext: {
        assetAmount: "0",
        liabilityAmount: "0",
        lossAmount: "100",
        gainAmount: "0",
        debitBalance: "100",
        creditBalance: "0",
      },
      mapping: { status: CompanyAccountMappingStatus.UNMAPPED },
    }));
    const service = new AccountSuggestionService(dataSource);
    Object.assign(service as object, {
      loadCompanyContext: async () => ({ industryId: null }),
      loadCompanyAccounts: async () => internalAccounts,
      loadSiiAccounts: async () => [expense],
      loadTerms: async () => [
        term(expense.id, "arriendo", "alias", 60),
        term(expense.id, "gastos de honorarios", "alias", 60),
        term(expense.id, "electricidad", "alias", 60),
      ],
      loadConcepts: async () => [],
      loadKnowledge: async () => [],
      loadRules: async () => [],
      loadLearning: async () => [],
    });

    const result = await service.generateForPeriod(companyId, "period-1");

    assert.equal(result.suggestionsCreated, 3);
    assert.equal(saved.length, 3);
    assert.deepEqual(
      saved.map((suggestion) => ({
        companyAccountId: suggestion.companyAccountId,
        siiAccountId: suggestion.siiAccountId,
        status: suggestion.status,
        suggestionRank: suggestion.suggestionRank,
        exactAlias: (suggestion.reasons as Array<{ signal: string }>).some(
          (reason) => reason.signal === "exact_alias",
        ),
      })),
      internalAccounts.map((account) => ({
        companyAccountId: account.id,
        siiAccountId: expense.id,
        status: CompanyAccountSuggestionStatus.ACTIVE,
        suggestionRank: 1,
        exactAlias: true,
      })),
    );
  });

  it("retrieves the complete active SII catalogue independently of terms and learning", async () => {
    let catalogueReads = 0;
    const service = new AccountSuggestionService(
      {} as DataSource,
      undefined,
      undefined,
      {
        findAccounts: async () => {
          catalogueReads++;
          return [
            sii("available", "1.01.01.00", "Disponible"),
            sii("unreferenced", "2.01.01.00", "Cuenta sin términos"),
          ];
        },
      } as never,
    );

    const result = await (
      service as unknown as {
        loadSiiAccounts: () => Promise<SiiAccountEntity[]>;
      }
    ).loadSiiAccounts();

    assert.equal(result.length, 2);
    assert.equal(catalogueReads, 1);
  });

  it("persists ranked suggestions and supersedes active rows without changing a mapping", async () => {
    const saved: Array<Record<string, unknown>> = [];
    const updates: Array<Record<string, unknown>> = [];
    const repository = {
      update: async (
        criteria: Record<string, unknown>,
        value: Record<string, unknown>,
      ) => {
        updates.push({ criteria, value });
      },
      create: (value: Record<string, unknown>) => value,
      save: async (values: Array<Record<string, unknown>>) => {
        saved.push(...values);
        return values;
      },
    };
    const dataSource = {
      transaction: async (
        callback: (manager: {
          getRepository: () => typeof repository;
        }) => unknown,
      ) => callback({ getRepository: () => repository }),
      getRepository: () => ({
        createQueryBuilder: () => ({
          where: () => ({
            andWhere: () => ({
              andWhere: () => ({
                orderBy: () => ({ getMany: async () => [] }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as DataSource;
    const service = new AccountSuggestionService(dataSource);
    Object.assign(service as object, {
      loadCompanyContext: async () => ({ industryId: null }),
      loadCompanyAccounts: async () => [
        {
          id: "internal-cash",
          name: "CAJA",
          mapping: { status: CompanyAccountMappingStatus.UNMAPPED },
        },
      ],
      loadSiiAccounts: async () => [
        sii("available", "1.01.01.00", "Disponible"),
      ],
      loadTerms: async () => [term("available", "caja", "alias", 60)],
      loadConcepts: async () => [],
      loadKnowledge: async () => [],
      loadRules: async () => [],
      loadLearning: async () => [],
    });

    const result = await service.generateForPeriod(companyId, "period-1");
    assert.equal(result.suggestionsCreated, 1);
    assert.equal(saved[0].companyAccountId, "internal-cash");
    assert.equal(saved[0].siiAccountId, "available");
    assert.equal(saved[0].suggestionRank, 1);
    assert.equal(saved[0].status, CompanyAccountSuggestionStatus.ACTIVE);
    assert.equal(updates.length, 1);
    assert.equal(
      (updates[0].value as Record<string, unknown>).status,
      CompanyAccountSuggestionStatus.SUPERSEDED,
    );
  });

  it("persists review candidates and ranks with the observed period snapshot", async () => {
    const saved: Array<Record<string, unknown>> = [];
    const repository = {
      update: async () => undefined,
      create: (value: Record<string, unknown>) => value,
      save: async (values: Array<Record<string, unknown>>) => {
        saved.push(...values);
        return values;
      },
      softDelete: undefined,
    };
    const dataSource = {
      transaction: async (
        callback: (manager: {
          getRepository: () => typeof repository;
        }) => unknown,
      ) => callback({ getRepository: () => repository }),
      getRepository: () => ({
        createQueryBuilder: () => ({
          where: () => ({
            andWhere: () => ({
              andWhere: () => ({
                orderBy: () => ({ getMany: async () => [] }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as DataSource;
    const service = new AccountSuggestionService(dataSource);
    Object.assign(service as object, {
      loadCompanyContext: async () => ({ industryId: null }),
      loadCompanyAccounts: async () => [
        {
          id: "internal-laundry",
          name: "Mercaderías",
          matchingContext: { accountNameSnapshot: "Insumos de Lavandería" },
          mapping: { status: CompanyAccountMappingStatus.UNMAPPED },
        },
      ],
      loadSiiAccounts: async () => [
        sii("laundry", "3.01.09.00", "Insumos de Lavandería"),
      ],
      loadTerms: async () => [],
      loadConcepts: async () => [],
      loadKnowledge: async () => [],
      loadRules: async () => [
        {
          id: "force-review",
          ruleKey: "force-review",
          priority: 100,
          condition: { sourcePattern: "lavanderia" },
          action: { type: "review" },
          explanation: "Revisión de prueba",
          active: true,
          deletedAt: null,
        },
      ],
      loadLearning: async () => [],
    });

    const result = await service.generateForPeriod(companyId, "period-1");
    assert.equal(result.suggestionsCreated, 1);
    assert.equal(saved[0].siiAccountId, "laundry");
    assert.equal(saved[0].status, CompanyAccountSuggestionStatus.REVIEW);
  });

  it("does not persist a review candidate supported only by Balance structure", async () => {
    const saved: Array<Record<string, unknown>> = [];
    const repository = {
      update: async () => undefined,
      create: (value: Record<string, unknown>) => value,
      save: async (values: Array<Record<string, unknown>>) => {
        saved.push(...values);
        return values;
      },
      softDelete: undefined,
    };
    const dataSource = {
      transaction: async (
        callback: (manager: {
          getRepository: () => typeof repository;
        }) => unknown,
      ) => callback({ getRepository: () => repository }),
      getRepository: () => ({
        createQueryBuilder: () => ({
          where: () => ({
            andWhere: () => ({
              andWhere: () => ({
                orderBy: () => ({ getMany: async () => [] }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as DataSource;
    const service = new AccountSuggestionService(dataSource);
    Object.assign(service as object, {
      loadCompanyContext: async () => ({ industryId: null }),
      loadCompanyAccounts: async () => [
        {
          id: "internal-laundry-supplies",
          name: "Mercaderías",
          matchingContext: {
            accountNameSnapshot: "Insumos de Lavandería",
            assetAmount: "100",
            liabilityAmount: "0",
            lossAmount: "0",
            gainAmount: "0",
            debitBalance: "100",
            creditBalance: "0",
          },
          mapping: { status: CompanyAccountMappingStatus.UNMAPPED },
        },
      ],
      loadSiiAccounts: async () => [
        sii("machinery", "1.02.03.00", "Maquinarias y equipos"),
      ],
      loadTerms: async () => [],
      loadConcepts: async () => [],
      loadKnowledge: async () => [],
      loadRules: async () => [],
      loadLearning: async () => [],
    });

    const result = await service.generateForPeriod(companyId, "period-1");
    assert.equal(saved.length, 0);
    assert.equal(result.suggestionsCreated, 0);
    assert.equal(result.withoutSuggestion, 1);
    assert.equal(
      result.withoutSuggestionReasons.insufficient_semantic_evidence,
      1,
    );
  });

  it("does not persist or alter confirmed mappings", async () => {
    let repositoryUsed = false;
    const repository = {
      update: async () => {
        repositoryUsed = true;
      },
      create: () => {
        repositoryUsed = true;
        return {};
      },
      save: async () => {
        repositoryUsed = true;
      },
    };
    const dataSource = {
      transaction: async (
        callback: (manager: {
          getRepository: () => typeof repository;
        }) => unknown,
      ) =>
        callback({
          getRepository: () => repository,
        }),
      getRepository: () => ({
        createQueryBuilder: () => ({
          where: () => ({
            andWhere: () => ({
              andWhere: () => ({
                orderBy: () => ({ getMany: async () => [] }),
              }),
            }),
          }),
        }),
      }),
    } as unknown as DataSource;
    const service = new AccountSuggestionService(dataSource);
    Object.assign(service as object, {
      loadCompanyContext: async () => ({ industryId: null }),
      loadCompanyAccounts: async () => [
        {
          id: "confirmed",
          name: "CAJA",
          mapping: { status: CompanyAccountMappingStatus.CONFIRMED },
        },
      ],
      loadSiiAccounts: async () => [
        sii("available", "1.01.01.00", "Disponible"),
      ],
      loadTerms: async () => [term("available", "caja", "alias", 60)],
      loadConcepts: async () => [],
      loadKnowledge: async () => [],
      loadRules: async () => [],
      loadLearning: async () => [],
    });
    const result = await service.generateForPeriod(companyId, "period-1");
    assert.equal(result.withoutSuggestionReasons.confirmed_mapping, 1);
    assert.equal(repositoryUsed, false);
  });

  it("reads bounded global and optional industry learning without legacy filters", async () => {
    const global = {
      id: "learning-1",
      normalizedName: "caja",
      normalizedNameHash: "hash",
      siiAccountId: "available",
      confirmationCount: 4,
      distinctCompanyCount: 3,
      agreementRate: "0.800000",
      confidence: "0.480000",
      deletedAt: null,
    } as AccountMatchingLearningEntity;
    const industry = {
      learningId: global.id,
      industryId: "retail",
      confirmationCount: 2,
      distinctCompanyCount: 2,
      agreementRate: "1.000000",
      confidence: "0.400000",
      deletedAt: null,
    } as AccountMatchingLearningIndustryEntity;
    const calls: Array<{ entity: unknown; options: unknown }> = [];
    const dataSource = {
      getRepository: (entity: unknown) => ({
        find: async (options: unknown) => {
          calls.push({ entity, options });
          return entity === AccountMatchingLearningEntity
            ? [global]
            : [industry];
        },
      }),
    } as unknown as DataSource;
    const service = new AccountSuggestionService(dataSource);
    const result = await (
      service as unknown as {
        loadLearning: (
          accounts: Array<{ name: string }>,
          industryId: string | null,
        ) => Promise<
          Array<
            AccountMatchingLearningEntity & {
              industryEvidence?: AccountMatchingLearningIndustryEntity;
            }
          >
        >;
      }
    ).loadLearning([{ name: "CAJA" }], "retail");

    assert.equal(calls.length, 2);
    assert.equal(result[0].industryEvidence, industry);
    const serialized = JSON.stringify(calls.map((call) => call.options));
    assert.doesNotMatch(serialized, /active|scope|companyId|promotionEligible/);
  });

  it("hashes only the observed period name for learning lookup", async () => {
    let options: unknown;
    const service = new AccountSuggestionService({
      getRepository: () => ({
        find: async (value: unknown) => {
          options = value;
          return [];
        },
      }),
    } as unknown as DataSource);
    await (
      service as unknown as {
        loadLearning: (
          accounts: Array<{
            name: string;
            matchingContext: { accountNameSnapshot: string };
          }>,
          industryId: null,
        ) => Promise<unknown[]>;
      }
    ).loadLearning(
      [
        {
          name: "Mercaderías",
          matchingContext: {
            accountNameSnapshot: "Insumos de Lavandería",
          },
        },
      ],
      null,
    );
    const observedHash = createHash("sha256")
      .update("insumos de lavanderia", "utf8")
      .digest("hex");
    const concatenatedHash = createHash("sha256")
      .update("mercaderias insumos de lavanderia", "utf8")
      .digest("hex");
    assert.match(JSON.stringify(options), new RegExp(observedHash));
    assert.doesNotMatch(JSON.stringify(options), new RegExp(concatenatedHash));
  });

  it("does not query industry learning when the company has no industry", async () => {
    let calls = 0;
    const dataSource = {
      getRepository: () => ({
        find: async () => {
          calls++;
          return [];
        },
      }),
    } as unknown as DataSource;
    const service = new AccountSuggestionService(dataSource);
    const result = await (
      service as unknown as {
        loadLearning: (
          accounts: Array<{ name: string }>,
          industryId: string | null,
        ) => Promise<AccountMatchingLearningEntity[]>;
      }
    ).loadLearning([{ name: "CAJA" }], null);

    assert.deepEqual(result, []);
    assert.equal(calls, 1);
  });
});

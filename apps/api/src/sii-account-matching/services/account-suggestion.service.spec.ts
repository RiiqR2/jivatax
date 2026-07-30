import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DataSource } from "typeorm";
import { CompanyAccountSuggestionStatus } from "../../accounting/entities/company-account-suggestion.entity";
import { CompanyAccountMappingStatus } from "../../company-account-plan/enums/company-account-plan.enums";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import {
  ACCOUNT_SUGGESTION_CONFIG,
  AccountSuggestionService,
} from "./account-suggestion.service";

const companyId = "company-1";
const sii = (id: string, code: string, name: string) =>
  ({ id, code, name }) as SiiAccountEntity;
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

function rank(
  name: string,
  accounts: SiiAccountEntity[],
  terms: SiiAccountTermEntity[],
) {
  const service = new AccountSuggestionService({} as DataSource);
  const internals = service as unknown as {
    buildTermIndexes: (items: SiiAccountTermEntity[]) => TermIndexes;
    rank: (
      siiAccountsById: Map<string, SiiAccountEntity>,
      positiveTerms: SiiAccountTermEntity[],
      negativeTerms: SiiAccountTermEntity[],
      normalizedName?: string,
    ) => RankResult;
  };
  const indexes = internals.buildTermIndexes(terms);
  const normalizedName = normalizeAccountTerm(name);
  return internals.rank(
    new Map(accounts.map((account) => [account.id, account])),
    indexes.positiveTermsByNormalizedTerm.get(normalizedName) ?? [],
    indexes.negativeTermsByNormalizedTerm.get(normalizedName) ?? [],
    normalizedName,
  );
}

type TermIndexes = {
  positiveTermsByNormalizedTerm: Map<string, SiiAccountTermEntity[]>;
  negativeTermsByNormalizedTerm: Map<string, SiiAccountTermEntity[]>;
};

type RankResult = {
  candidates: Array<{
    account: SiiAccountEntity;
    score: number;
    confidence: number;
    reasons: Array<{ signal: string; description: string; points: number }>;
  }>;
  discardReason?: string;
};

function buildTermIndexes(terms: SiiAccountTermEntity[]) {
  const service = new AccountSuggestionService({} as DataSource);
  return (
    service as unknown as {
      buildTermIndexes: (items: SiiAccountTermEntity[]) => TermIndexes;
    }
  ).buildTermIndexes(terms);
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

  it("indexes hydrated entities by normalizedTerm, not normalized_term", () => {
    const caja = term(disponible.id, "caja", "alias", 60);
    Object.assign(caja as object, { normalized_term: "wrong-key" });
    const indexes = buildTermIndexes([caja]);

    assert.equal(indexes.positiveTermsByNormalizedTerm.has("caja"), true);
    assert.equal(indexes.positiveTermsByNormalizedTerm.has("wrong-key"), false);
    assert.equal(
      indexes.positiveTermsByNormalizedTerm.get("caja")?.[0].siiAccountId,
      disponible.id,
    );
    assert.equal(
      indexes.positiveTermsByNormalizedTerm.get("caja")?.[0].type,
      "alias",
    );
    assert.equal(
      Number(indexes.positiveTermsByNormalizedTerm.get("caja")?.[0].weight),
      60,
    );
  });

  it("keeps negative terms in a separate normalized-term index", () => {
    const indexes = buildTermIndexes([
      term(disponible.id, "caja", "alias", 60),
      term(disponible.id, "caja", "negative_term", 10),
    ]);
    assert.equal(indexes.positiveTermsByNormalizedTerm.get("caja")?.length, 1);
    assert.equal(indexes.negativeTermsByNormalizedTerm.get("caja")?.length, 1);
    assert.equal(
      indexes.positiveTermsByNormalizedTerm.get("caja")?.[0].type,
      "alias",
    );
    assert.equal(
      indexes.negativeTermsByNormalizedTerm.get("caja")?.[0].type,
      "negative_term",
    );
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
    assert.equal(result.candidates[0]?.score, 60);
  });

  it("converts a decimal string weight before scoring", () => {
    const caja = term(disponible.id, "caja", "alias", 60);
    caja.weight = "60.00" as unknown as number;

    const result = rank("CAJA", [disponible], [caja]);
    assert.equal(result.candidates[0]?.score, 60);
    assert.equal(typeof result.candidates[0]?.score, "number");
  });

  it("uses erp_term for CLIENTES and accumulates exact machinery signals", () => {
    const clientResult = rank(
      "CLIENTES",
      [clientes],
      [term(clientes.id, "clientes", "erp_term", 60)],
    );
    assert.equal(clientResult.candidates[0]?.account.id, clientes.id);
    assert.equal(clientResult.candidates[0]?.score, 60);

    const machineryResult = rank(
      "MAQUINARIAS Y EQUIPOS",
      [maquinaria],
      [
        term(maquinaria.id, "maquinarias y equipos", "erp_term", 60),
        term(maquinaria.id, "maquinarias y equipos", "official_name", 45),
      ],
    );
    assert.equal(machineryResult.candidates[0]?.score, 60);
    assert.equal(machineryResult.candidates[0]?.reasons.length, 1);
    const machineryIndexes = buildTermIndexes([
      term(maquinaria.id, "maquinarias y equipos", "erp_term", 60),
      term(maquinaria.id, "maquinarias y equipos", "official_name", 45),
    ]);
    assert.equal(
      machineryIndexes.positiveTermsByNormalizedTerm.get(
        "maquinarias y equipos",
      )?.length,
      2,
    );
  });

  it("does not let negative_term create a candidate", () => {
    const result = rank(
      "CAJA",
      [disponible],
      [term(disponible.id, "caja", "negative_term", 60)],
    );
    assert.equal(result.candidates.length, 0);
    assert.equal(result.discardReason, "all_candidates_penalized");
  });

  it("keeps score and confidence scales coherent", () => {
    assert.ok(ACCOUNT_SUGGESTION_CONFIG.minimumSuggestionScore <= 55);
    const result = rank(
      "BANCOS",
      [disponible],
      [term(disponible.id, "bancos", "alias", 55)],
    );
    assert.equal(result.candidates[0].score, 60);
    assert.ok(result.candidates[0].confidence >= 0);
    assert.ok(result.candidates[0].confidence <= 1);
  });

  it("uses deterministic token similarity without confusing bank debt with Disponible", () => {
    const service = new AccountSuggestionService({} as DataSource);
    const internal = service as unknown as {
      rank: (
        accounts: Map<string, SiiAccountEntity>,
        positive: SiiAccountTermEntity[],
        negative: SiiAccountTermEntity[],
        name: string,
      ) => RankResult;
    };
    const result = internal.rank(
      new Map([[disponible.id, disponible]]),
      [term(disponible.id, "bancos", "alias", 55)],
      [term(disponible.id, "deudas con bancos", "negative_term", 50)],
      normalizeAccountTerm("DEUDAS CON BANCOS CORTO PLAZO"),
    );
    assert.equal(result.candidates.length, 0);
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

  it("marks candidates with equal evidence as ambiguous", () => {
    const result = rank(
      "CLIENTES",
      [clientes, sii("documents", "1.01.08.00", "Documentos por cobrar")],
      [
        term(clientes.id, "clientes", "alias", 60),
        term("documents", "clientes", "manual_term", 60),
      ],
    );
    assert.equal(result.discardReason, "ambiguous_candidates");
    assert.equal(
      result.candidates[0].reasons.at(-1)?.signal,
      "ambiguous_candidates",
    );
  });
});

describe("AccountSuggestionService persistence", () => {
  it("loads SII accounts only by the IDs referenced by terms", async () => {
    let findOptions: Record<string, unknown> | undefined;
    const repository = {
      find: async (options: Record<string, unknown>) => {
        findOptions = options;
        return [sii("available", "1.01.01.00", "Disponible")];
      },
    };
    const service = new AccountSuggestionService({
      getRepository: () => repository,
    } as unknown as DataSource);

    const result = await (
      service as unknown as {
        loadSiiAccounts: (ids: string[]) => Promise<SiiAccountEntity[]>;
      }
    ).loadSiiAccounts(["available", "receivables"]);

    assert.equal(result.length, 1);
    assert.ok(findOptions);
    assert.deepEqual(Object.keys(findOptions), ["where"]);
    const where = findOptions.where as { id: { value: string[] } };
    assert.deepEqual(where.id.value, ["available", "receivables"]);
    assert.equal("versionId" in where, false);
    assert.equal("status" in where, false);
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
    } as unknown as DataSource;
    const service = new AccountSuggestionService(dataSource);
    Object.assign(service as object, {
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
    } as unknown as DataSource;
    const service = new AccountSuggestionService(dataSource);
    Object.assign(service as object, {
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
    });
    const result = await service.generateForPeriod(companyId, "period-1");
    assert.equal(result.withoutSuggestionReasons.confirmed_mapping, 1);
    assert.equal(repositoryUsed, false);
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Repository } from "typeorm";
import type { EntityManager } from "typeorm";
import { SiiAccountTermEntity } from "../../sii-account-matching/entities/sii-account-term.entity";
import { PeriodAccountMappingsService } from "./period-account-mappings.service";
import { CompanyAccountMappingStatus } from "../../company-account-plan/enums/company-account-plan.enums";
import { CompanyAccountMappingEntity } from "../../company-account-plan/entities/company-account-mapping.entity";
import { CompanyAccountSuggestionEntity } from "../entities/company-account-suggestion.entity";
import { TaxPeriodCompanyAccountEntity } from "../entities/tax-period-company-account.entity";

const source = readFileSync(
  join(__dirname, "period-account-mappings.service.ts"),
  "utf8",
);

test("list usa QueryBuilder y conserva filtros, búsqueda, summary y sugerencia principal", () => {
  assert.doesNotMatch(source, /dataSource\.query|manager\.query/);
  assert.match(source, /periodAccount\.sourceDocumentId = :documentId/);
  assert.match(source, /mapping\.status = :mappingStatus/);
  assert.match(
    source,
    /account\.firstSeenTaxPeriodId = periodAccount\.taxPeriodId/,
  );
  assert.match(source, /account\.name <> periodAccount\.accountNameSnapshot/);
  assert.match(source, /account\.internalCode LIKE :search/);
  assert.match(source, /suggestion\.suggestionRank = :primaryRank/);
  assert.match(source, /primaryRank: 1/);
  assert.match(source, /suggestedCount/);
  assert.match(source, /highConfidence/);
  assert.doesNotMatch(source, /suggestionRank: [23]/);
  assert.match(source, /query\.status === "suggested"/);
  assert.match(source, /suggestion\.id IS NOT NULL/);
  assert.match(source, /query\.status === "withoutSuggestion"/);
  assert.match(source, /suggestion\.id IS NULL/);
  assert.match(source, /mapping\.status = :pendingMappingStatus/);
  assert.match(
    source,
    /CompanyAccountMappingStatus\.CONFIRMED[\s\S]*CompanyAccountMappingStatus\.PENDING/,
  );
});

test("update usa repositorios transaccionales, relaciones e historial", () => {
  assert.match(source, /manager\.getRepository\(CompanyAccountMappingEntity\)/);
  assert.match(source, /companyAccount: \{ companyId \}/);
  assert.match(source, /historyRepository\.create/);
  assert.match(source, /historyRepository\.save/);
  assert.match(source, /CompanyAccountSuggestionStatus\.ACCEPTED/);
  assert.match(source, /CompanyAccountSuggestionStatus\.REJECTED/);
  assert.match(
    source,
    /currentCatalog\.containsAccount\(dto\.siiAccountId!, manager\)/,
  );
  assert.match(source, /no pertenece al catálogo vigente/);
});

test("aprobación masiva valida período, estado y sugerencia principal y reutiliza el dominio", () => {
  assert.match(source, /async approveBatch/);
  assert.match(source, /TaxPeriodCompanyAccountEntity/);
  assert.match(source, /mapping_not_pending/);
  assert.match(source, /active_primary_suggestion_not_found/);
  assert.match(source, /applyMappingDecision/);
  assert.match(source, /CompanyAccountSuggestionStatus\.SUPERSEDED/);
});

test("history carga relaciones y presenta solamente el contrato público", () => {
  assert.match(source, /previousSiiAccount: true/);
  assert.match(source, /newSiiAccount: true/);
  assert.match(source, /changedByUser: true/);
  assert.doesNotMatch(source, /\.\.\.history/);
});

test("alias de empresa no se duplica ni reactiva si ya existe", async () => {
  let saves = 0;
  const existing = { id: "term", active: false } as SiiAccountTermEntity;
  const repository = {
    findOne: async () => existing,
    create: (value: Partial<SiiAccountTermEntity>) => value,
    save: async () => {
      saves++;
    },
  } as unknown as Repository<SiiAccountTermEntity>;
  type AliasCreator = {
    createCompanyAlias(
      repository: Repository<SiiAccountTermEntity>,
      account: { name: string; companyId: string },
      siiAccountId: string,
    ): Promise<void>;
  };
  const service = Object.create(
    PeriodAccountMappingsService.prototype,
  ) as AliasCreator;
  await service.createCompanyAlias(
    repository,
    { name: "BANCO SANTANDER", companyId: "company" },
    "sii",
  );
  assert.equal(saves, 0);
  assert.equal(existing.active, false);
});

test("alias de empresa se crea normalizado cuando no existe", async () => {
  let saved: Partial<SiiAccountTermEntity> | undefined;
  const repository = {
    findOne: async () => null,
    create: (value: Partial<SiiAccountTermEntity>) => value,
    save: async (value: Partial<SiiAccountTermEntity>) => {
      saved = value;
      return value;
    },
  } as unknown as Repository<SiiAccountTermEntity>;
  type AliasCreator = {
    createCompanyAlias(
      repository: Repository<SiiAccountTermEntity>,
      account: { name: string; companyId: string },
      siiAccountId: string,
    ): Promise<void>;
  };
  const service = Object.create(
    PeriodAccountMappingsService.prototype,
  ) as AliasCreator;
  await service.createCompanyAlias(
    repository,
    { name: "BÁNCO  SANTANDER", companyId: "company" },
    "sii",
  );
  assert.equal(saved?.normalizedTerm, "banco santander");
  assert.equal(saved?.scope, "company");
  assert.equal(saved?.active, true);
});

type OrchestrationService = {
  dataSource: {
    transaction<T>(work: (manager: EntityManager) => Promise<T>): Promise<T>;
  };
  periods: { get(companyId: string, taxPeriodId: string): Promise<unknown> };
  learningAggregatorService: {
    rebuildWithManager(manager: EntityManager): Promise<void>;
  };
  applyMappingDecision(
    manager: EntityManager,
    companyId: string,
    accountId: string,
    userId: string,
    dto: { action: "confirm" | "reject"; siiAccountId?: string },
  ): Promise<unknown>;
  update: PeriodAccountMappingsService["update"];
  approveBatch: PeriodAccountMappingsService["approveBatch"];
};

function orchestrationService(options?: { rebuildError?: Error }) {
  const manager = {} as EntityManager;
  let committed = false;
  const rebuildManagers: EntityManager[] = [];
  const decisions: Array<{ accountId: string; action: string }> = [];
  const service = Object.create(
    PeriodAccountMappingsService.prototype,
  ) as OrchestrationService;
  service.dataSource = {
    async transaction<T>(work: (manager: EntityManager) => Promise<T>) {
      const result = await work(manager);
      committed = true;
      return result;
    },
  };
  service.periods = { get: async () => ({}) };
  service.learningAggregatorService = {
    async rebuildWithManager(receivedManager: EntityManager) {
      rebuildManagers.push(receivedManager);
      if (options?.rebuildError) throw options.rebuildError;
    },
  };
  service.applyMappingDecision = async (
    _manager: EntityManager,
    _companyId: string,
    accountId: string,
    _userId: string,
    dto: { action: "confirm" | "reject"; siiAccountId?: string },
  ) => {
    decisions.push({ accountId, action: dto.action });
    return { id: accountId, status: dto.action };
  };
  return {
    service,
    manager,
    rebuildManagers,
    decisions,
    committed: () => committed,
  };
}

test("confirmación individual reconstruye una vez con el mismo manager", async () => {
  const harness = orchestrationService();
  const result = await harness.service.update("company", "account", "user", {
    action: "confirm",
    siiAccountId: "sii",
  });
  assert.deepEqual(result, { id: "account", status: "confirm" });
  assert.deepEqual(harness.decisions, [
    { accountId: "account", action: "confirm" },
  ]);
  assert.deepEqual(harness.rebuildManagers, [harness.manager]);
  assert.equal(harness.committed(), true);
});

test("rechazo individual no reconstruye aprendizaje", async () => {
  const harness = orchestrationService();
  await harness.service.update("company", "account", "user", {
    action: "reject",
  });
  assert.equal(harness.decisions.length, 1);
  assert.equal(harness.rebuildManagers.length, 0);
  assert.equal(harness.committed(), true);
});

function batchHarness(
  states: Record<string, "approved" | "not-pending" | "missing">,
) {
  const harness = orchestrationService();
  const suggestions = new Map(
    Object.entries(states).flatMap(([id, state]) =>
      state === "approved" ? [[id, { siiAccountId: `sii-${id}` }]] : [],
    ),
  );
  const manager = {
    getRepository(entity: unknown) {
      if (entity === TaxPeriodCompanyAccountEntity)
        return {
          existsBy: async ({
            companyAccountId,
          }: {
            companyAccountId: string;
          }) => states[companyAccountId] !== "missing",
        };
      if (entity === CompanyAccountMappingEntity)
        return {
          findOneBy: async ({
            companyAccountId,
          }: {
            companyAccountId: string;
          }) => ({
            status:
              states[companyAccountId] === "not-pending"
                ? CompanyAccountMappingStatus.CONFIRMED
                : CompanyAccountMappingStatus.PENDING,
          }),
        };
      if (entity === CompanyAccountSuggestionEntity)
        return {
          findOneBy: async ({
            companyAccountId,
          }: {
            companyAccountId: string;
          }) => suggestions.get(companyAccountId) ?? null,
        };
      throw new Error("Repositorio inesperado");
    },
  } as unknown as EntityManager;
  harness.manager = manager;
  harness.service.dataSource.transaction = async <T>(
    work: (received: EntityManager) => Promise<T>,
  ) => work(manager);
  return harness;
}

test("batch con tres aprobaciones registra tres decisiones y reconstruye una vez", async () => {
  const harness = batchHarness({ a: "approved", b: "approved", c: "approved" });
  const result = await harness.service.approveBatch(
    "company",
    "period",
    "user",
    ["a", "b", "c"],
  );
  assert.equal(result.approved, 3);
  assert.equal(harness.decisions.length, 3);
  assert.deepEqual(harness.rebuildManagers, [harness.manager]);
});

test("batch mixto omite cuentas inválidas y reconstruye una sola vez", async () => {
  const harness = batchHarness({
    approved: "approved",
    confirmed: "not-pending",
    foreign: "missing",
  });
  const result = await harness.service.approveBatch(
    "company",
    "period",
    "user",
    ["approved", "confirmed", "foreign"],
  );
  assert.equal(result.approved, 1);
  assert.equal(result.skipped, 2);
  assert.equal(harness.decisions.length, 1);
  assert.deepEqual(harness.rebuildManagers, [harness.manager]);
});

test("batch completamente omitido no reconstruye", async () => {
  const harness = batchHarness({
    confirmed: "not-pending",
    foreign: "missing",
  });
  const result = await harness.service.approveBatch(
    "company",
    "period",
    "user",
    ["confirmed", "foreign"],
  );
  assert.equal(result.approved, 0);
  assert.equal(harness.decisions.length, 0);
  assert.equal(harness.rebuildManagers.length, 0);
});

test("error del rebuild se propaga y la transacción no finaliza", async () => {
  const failure = new Error("rebuild failed");
  const harness = orchestrationService({ rebuildError: failure });
  await assert.rejects(
    harness.service.update("company", "account", "user", {
      action: "confirm",
      siiAccountId: "sii",
    }),
    failure,
  );
  assert.equal(harness.committed(), false);
  assert.equal(harness.rebuildManagers.length, 1);
});

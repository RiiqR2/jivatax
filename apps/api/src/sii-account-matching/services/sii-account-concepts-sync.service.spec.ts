import assert from "node:assert/strict";
import test from "node:test";
import { DataSource } from "typeorm";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountPlanVersionEntity } from "../../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountPlanVersionStatus } from "../../sii-account-plan/enums/sii-account-plan-version-status.enum";
import { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import { SiiAccountConceptsSyncService } from "./sii-account-concepts-sync.service";

const version = {
  id: "version",
  code: "catalog-2026",
  name: "Catálogo 2026",
  status: SiiAccountPlanVersionStatus.ACTIVE,
} as SiiAccountPlanVersionEntity;

function fixture(initial: Partial<SiiAccountConceptEntity>[] = []) {
  const accounts = [
    {
      id: "cash",
      versionId: "version",
      code: "1.01.01.00",
      name: "Disponible circulante",
      sortOrder: 1,
    },
    {
      id: "payable",
      versionId: "version",
      code: "2.01.01.00",
      name: "Cuentas por pagar",
      sortOrder: 2,
    },
    {
      id: "unknown",
      versionId: "version",
      code: "9.01.01.00",
      name: "Otros",
      sortOrder: 3,
    },
  ] as SiiAccountEntity[];
  const saved = initial.map((item) => ({
    ...item,
  })) as SiiAccountConceptEntity[];
  let transactionCalls = 0;
  let batchSaveCalls = 0;
  let conceptFindCalls = 0;
  const accountRepository = {
    count: async () => accounts.length,
    find: async () => accounts,
  };
  const versionRepository = { find: async () => [version] };
  const conceptRepository = {
    find: async () => {
      conceptFindCalls++;
      return saved;
    },
    create: (item: SiiAccountConceptEntity) => item,
    save: async (items: SiiAccountConceptEntity[]) => {
      batchSaveCalls++;
      assert.ok(Array.isArray(items));
      saved.push(...items);
      return items;
    },
  };
  const manager = {
    getRepository: (entity: unknown) =>
      entity === SiiAccountConceptEntity
        ? conceptRepository
        : entity === SiiAccountEntity
          ? accountRepository
          : versionRepository,
  };
  const dataSource = {
    transaction: async (work: (value: typeof manager) => unknown) => {
      transactionCalls++;
      return work(manager);
    },
  } as unknown as DataSource;
  return {
    service: new SiiAccountConceptsSyncService(dataSource),
    saved,
    accounts,
    metrics: () => ({ transactionCalls, batchSaveCalls, conceptFindCalls }),
  };
}

const knowledge = [
  {
    siiAccountCode: "1.01.01.00",
    concepts: [
      {
        concept: "Disponibilidad inmediata",
        type: "economic_concept" as const,
        weight: 90,
      },
    ],
  },
];

test("combina curados y derivados en una única transacción e inserción por lote", async () => {
  const state = fixture();
  const beforeAccounts = structuredClone(state.accounts);
  const result = await state.service.synchronize(knowledge);
  assert.equal(result.curatedConceptsCreated, 1);
  assert.ok(result.derivedConceptsCreated > 0);
  assert.deepEqual(result.accountsWithoutConcepts, ["9.01.01.00"]);
  assert.deepEqual(state.metrics(), {
    transactionCalls: 1,
    batchSaveCalls: 1,
    conceptFindCalls: 1,
  });
  assert.ok(state.saved.some((item) => item.source === "jivatax_curated"));
  assert.ok(state.saved.some((item) => item.source === "catalog_derived"));
  assert.deepEqual(state.accounts, beforeAccounts);
});

test("la segunda ejecución es idempotente y evita duplicados", async () => {
  const state = fixture();
  await state.service.synchronize(knowledge);
  const count = state.saved.length;
  const second = await state.service.synchronize(knowledge);
  assert.equal(second.curatedConceptsCreated, 0);
  assert.equal(second.derivedConceptsCreated, 0);
  assert.ok(second.existingConceptsSkipped > 0);
  assert.equal(state.saved.length, count);
});

test("no reactiva inactivos ni sobrescribe pesos", async () => {
  const state = fixture([
    {
      siiAccountId: "cash",
      normalizedConcept: "disponibilidad inmediata",
      concept: "Disponibilidad inmediata",
      conceptType: "economic_concept",
      source: "jivatax_curated",
      active: false,
      weight: 12,
    },
  ]);
  const result = await state.service.synchronize(knowledge);
  assert.equal(result.inactiveConceptsSkipped, 1);
  assert.equal(state.saved[0].active, false);
  assert.equal(state.saved[0].weight, 12);
});

test("reporta códigos curados ausentes sin crear cuentas", async () => {
  const state = fixture();
  const count = state.accounts.length;
  const result = await state.service.synchronize([
    ...knowledge,
    {
      siiAccountCode: "9.99.99.99",
      concepts: [
        { concept: "ausente", type: "economic_concept" as const, weight: 1 },
      ],
    },
  ]);
  assert.deepEqual(result.missingReferencedAccounts, ["9.99.99.99"]);
  assert.equal(state.accounts.length, count);
});

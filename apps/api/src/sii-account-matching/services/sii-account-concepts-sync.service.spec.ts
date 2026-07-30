import assert from "node:assert/strict";
import test from "node:test";
import type { Repository } from "typeorm";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountPlanVersionEntity } from "../../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountPlanVersionStatus } from "../../sii-account-plan/enums/sii-account-plan-version-status.enum";
import type { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import { SiiAccountConceptsSyncService } from "./sii-account-concepts-sync.service";

function fixture(initial: Partial<SiiAccountConceptEntity>[] = []) {
  const account = {
    id: "account",
    versionId: "version",
    code: "1.01.01.00",
    sortOrder: 1,
  } as SiiAccountEntity;
  const version = {
    id: "version",
    code: "catalog-2026",
    name: "Catálogo 2026",
    status: SiiAccountPlanVersionStatus.ACTIVE,
  } as SiiAccountPlanVersionEntity;
  const saved = initial.map((item) => ({
    ...item,
  })) as SiiAccountConceptEntity[];
  const accounts = {
    count: async () => 1,
    find: async () => [account],
  } as unknown as Repository<SiiAccountEntity>;
  const versions = {
    find: async () => [version],
  } as unknown as Repository<SiiAccountPlanVersionEntity>;
  const concepts = {
    findOne: async ({ where }: { where: Partial<SiiAccountConceptEntity> }) =>
      saved.find(
        (item) =>
          item.siiAccountId === where.siiAccountId &&
          item.normalizedConcept === where.normalizedConcept &&
          item.conceptType === where.conceptType &&
          item.source === where.source,
      ) ?? null,
    create: (item: SiiAccountConceptEntity) => item,
    save: async (item: SiiAccountConceptEntity) => {
      saved.push(item);
      return item;
    },
  } as unknown as Repository<SiiAccountConceptEntity>;
  return {
    service: new SiiAccountConceptsSyncService(accounts, versions, concepts),
    saved,
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

test("crea conceptos normalizados y la segunda ejecución es idempotente", async () => {
  const state = fixture();
  const first = await state.service.synchronize(knowledge);
  const second = await state.service.synchronize(knowledge);
  assert.equal(first.conceptsCreated, 1);
  assert.equal(second.conceptsCreated, 0);
  assert.equal(second.existingConceptsSkipped, 1);
  assert.equal(state.saved[0].normalizedConcept, "disponibilidad inmediata");
  assert.equal(state.saved[0].weight, 90);
});

test("no reactiva ni sobrescribe conceptos inactivos y reporta códigos ausentes", async () => {
  const state = fixture([
    {
      siiAccountId: "account",
      normalizedConcept: "disponibilidad inmediata",
      conceptType: "economic_concept",
      source: "jivatax_curated",
      active: false,
      weight: 12,
    },
  ]);
  const result = await state.service.synchronize([
    ...knowledge,
    {
      siiAccountCode: "9.99.99.99",
      concepts: [
        { concept: "ausente", type: "economic_concept" as const, weight: 1 },
      ],
    },
  ]);
  assert.equal(result.inactiveConceptsSkipped, 1);
  assert.deepEqual(result.missingReferencedAccounts, ["9.99.99.99"]);
  assert.equal(state.saved[0].active, false);
  assert.equal(state.saved[0].weight, 12);
});

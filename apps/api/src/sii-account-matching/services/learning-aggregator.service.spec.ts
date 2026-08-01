import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LearningAggregatorService } from "./learning-aggregator.service";
import type { EntityManager } from "typeorm";
import {
  AccountMatchingConfirmationEntity,
  ConfirmationSource,
} from "../entities/account-matching-confirmation.entity";
import { AccountMatchingLearningEntity } from "../entities/account-matching-learning.entity";
import { AccountMatchingLearningIndustryEntity } from "../entities/account-matching-learning-industry.entity";

describe("LearningAggregatorService confidence", () => {
  const service = new LearningAggregatorService({} as never);
  it("combina consenso con una muestra transparente y acotada", () => {
    assert.ok(Math.abs(service.calculateConfidence(0.8, 1) - 0.16) < 1e-12);
    assert.equal(service.calculateConfidence(0.8, 5), 0.8);
    assert.equal(service.calculateConfidence(0.8, 20), 0.8);
  });
  it("da base 0.8 a evidencia experta sin rebajar evidencia colectiva", () => {
    assert.equal(service.calculateConfidence(1, 0, 1), 0.8);
    assert.equal(service.calculateConfidence(1, 5, 1), 1);
    assert.equal(service.calculateConfidence(0.5, 1, 1), 0.4);
  });
});

it("reconstruye evidencia global y por rubro excluyendo confirmaciones invalidadas", async () => {
  const now = new Date("2026-07-31T12:00:00.000Z");
  const confirmations = [
    {
      normalizedName: "iva credito fiscal",
      normalizedNameHash: "iva-hash",
      siiAccountId: "sii-iva",
      companyId: null,
      industryId: null,
      source: ConfirmationSource.EXPERT,
      confirmedAt: now,
      invalidatedAt: null,
    },
    {
      normalizedName: "iva credito fiscal",
      normalizedNameHash: "iva-hash",
      siiAccountId: "sii-iva",
      companyId: "company-1",
      industryId: "industry-1",
      source: ConfirmationSource.USER,
      confirmedAt: now,
      invalidatedAt: null,
    },
    {
      normalizedName: "iva credito fiscal",
      normalizedNameHash: "iva-hash",
      siiAccountId: "sii-other",
      companyId: "company-invalidated",
      industryId: "industry-1",
      source: ConfirmationSource.USER,
      confirmedAt: now,
      invalidatedAt: now,
    },
  ] as AccountMatchingConfirmationEntity[];
  const learning: AccountMatchingLearningEntity[] = [];
  const industries: AccountMatchingLearningIndustryEntity[] = [];
  let nextId = 1;
  const repository = <T extends { id?: string }>(rows: T[]) => ({
    create: (value: T) => value,
    save: async (value: T) => {
      if (!value.id) value.id = `generated-${nextId++}`;
      rows.push(value);
      return value;
    },
    createQueryBuilder: () => ({
      delete: () => ({
        execute: async () => {
          rows.splice(0);
        },
      }),
    }),
  });
  const manager = {
    getRepository(entity: unknown) {
      if (entity === AccountMatchingConfirmationEntity)
        return {
          findBy: async () =>
            confirmations.filter((item) => item.invalidatedAt === null),
        };
      if (entity === AccountMatchingLearningEntity) return repository(learning);
      if (entity === AccountMatchingLearningIndustryEntity)
        return repository(industries);
      throw new Error("Repositorio inesperado");
    },
  } as EntityManager;
  const service = new LearningAggregatorService({} as never);

  await service.rebuildWithManager(manager);

  assert.equal(learning.length, 1);
  assert.equal(learning[0].confirmationCount, 2);
  assert.equal(learning[0].distinctCompanyCount, 1);
  assert.equal(learning[0].expertConfirmationCount, 1);
  assert.equal(
    Number(learning[0].confidence),
    service.calculateConfidence(1, 1, 1),
  );
  assert.equal(industries.length, 1);
  assert.equal(industries[0].industryId, "industry-1");
  assert.equal(industries[0].confirmationCount, 1);
  assert.equal(industries[0].distinctCompanyCount, 1);
  assert.equal(industries[0].expertConfirmationCount, 0);
});

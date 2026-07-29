import assert from "node:assert/strict";
import test from "node:test";
import { Global, Module } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SiiAccountEntity } from "../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../sii-account-plan/entities/sii-account-plan-version.entity";
import { assertSyncEntitiesMetadata } from "./commands/sync-entities-metadata";
import { SiiAccountTermEntity } from "./entities/sii-account-term.entity";
import { SiiAccountTermsSyncService } from "./services/sii-account-terms-sync.service";
import { SiiAccountMatchingModule } from "./sii-account-matching.module";

test("el contexto del módulo registra las entidades requeridas por el sync", async () => {
  const registeredEntities = new Set<object>([
    SiiAccountEntity,
    SiiAccountPlanVersionEntity,
    SiiAccountTermEntity,
  ]);
  const repositories = new Map<object, object>();
  const dataSource = {
    entityMetadatas: [...registeredEntities].map((target) => ({ target })),
    options: { type: "mysql" },
    hasMetadata: (entity: object) => registeredEntities.has(entity),
    getRepository: (entity: object) => {
      const repository = repositories.get(entity) ?? {};
      repositories.set(entity, repository);
      return repository;
    },
  } as unknown as DataSource;

  @Global()
  @Module({
    providers: [{ provide: DataSource, useValue: dataSource }],
    exports: [DataSource],
  })
  class RuntimeDataSourceTestModule {}

  const context = await Test.createTestingModule({
    imports: [RuntimeDataSourceTestModule, SiiAccountMatchingModule],
  }).compile();
  try {
    assertSyncEntitiesMetadata(context.get(DataSource));
    assert.equal(dataSource.hasMetadata(SiiAccountTermEntity), true);
    assert.ok(
      context.get<Repository<SiiAccountTermEntity>>(
        getRepositoryToken(SiiAccountTermEntity),
      ),
    );
    assert.ok(context.get(SiiAccountTermsSyncService));
  } finally {
    await context.close();
  }
});

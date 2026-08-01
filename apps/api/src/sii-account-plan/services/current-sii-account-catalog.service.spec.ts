import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DataSource, Repository } from "typeorm";
import { SiiAccountEntity } from "../entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../entities/sii-account-plan-version.entity";
import { CurrentSiiAccountCatalogService } from "./current-sii-account-catalog.service";

describe("CurrentSiiAccountCatalogService", () => {
  it("elige una sola versión ACTIVE: la importada más recientemente", async () => {
    const calls: unknown[] = [];
    const versions = {
      findOne: async (options: unknown) => {
        calls.push(options);
        return { id: "current-version" };
      },
    } as unknown as Repository<SiiAccountPlanVersionEntity>;
    const accounts = {
      findBy: async (where: unknown) => {
        calls.push(where);
        return [{ id: "current-account", versionId: "current-version" }];
      },
    } as unknown as Repository<SiiAccountEntity>;
    const dataSource = dataSourceWith(versions, accounts);

    const result = await new CurrentSiiAccountCatalogService(
      dataSource,
    ).findAccounts();

    assert.deepEqual(
      result.map((account) => account.id),
      ["current-account"],
    );
    assert.deepEqual(calls[1], { versionId: "current-version" });
    assert.deepEqual((calls[0] as { order: object }).order, {
      importedAt: "DESC",
      createdAt: "DESC",
      id: "DESC",
    });
  });

  it("rechaza cuentas históricas al validar una homologación nueva", async () => {
    const versions = {
      findOne: async () => ({ id: "current-version" }),
    } as unknown as Repository<SiiAccountPlanVersionEntity>;
    const checked: unknown[] = [];
    const accounts = {
      existsBy: async (where: unknown) => {
        checked.push(where);
        return false;
      },
    } as unknown as Repository<SiiAccountEntity>;
    const service = new CurrentSiiAccountCatalogService(
      dataSourceWith(versions, accounts),
    );

    assert.equal(await service.containsAccount("historical-account"), false);
    assert.deepEqual(checked, [
      { id: "historical-account", versionId: "current-version" },
    ]);
  });
});

function dataSourceWith(
  versions: Repository<SiiAccountPlanVersionEntity>,
  accounts: Repository<SiiAccountEntity>,
) {
  return {
    manager: {
      getRepository: (entity: unknown) =>
        entity === SiiAccountPlanVersionEntity ? versions : accounts,
    },
  } as DataSource;
}

import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import {
  DataSource,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
  Repository,
} from "typeorm";
import { SiiAccountEntity } from "../entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../entities/sii-account-plan-version.entity";
import { SiiAccountPlanVersionStatus } from "../enums/sii-account-plan-version-status.enum";

/**
 * Single source of truth for the catalogue that may be used by new matching
 * operations. Historical versions remain queryable through the administrative
 * catalogue, but are deliberately excluded here.
 */
@Injectable()
export class CurrentSiiAccountCatalogService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getVersionId(manager?: EntityManager): Promise<string | null> {
    const version = await this.repository(
      SiiAccountPlanVersionEntity,
      manager,
    ).findOne({
      select: { id: true },
      where: { status: SiiAccountPlanVersionStatus.ACTIVE },
      order: { importedAt: "DESC", createdAt: "DESC", id: "DESC" },
    });
    return version?.id ?? null;
  }

  async findAccounts(manager?: EntityManager): Promise<SiiAccountEntity[]> {
    const versionId = await this.getVersionId(manager);
    if (!versionId) return [];
    return this.repository(SiiAccountEntity, manager).findBy({ versionId });
  }

  async containsAccount(
    accountId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const versionId = await this.getVersionId(manager);
    if (!versionId) return false;
    return this.repository(SiiAccountEntity, manager).existsBy({
      id: accountId,
      versionId,
    });
  }

  private repository<Entity extends ObjectLiteral>(
    target: EntityTarget<Entity>,
    manager?: EntityManager,
  ): Repository<Entity> {
    return (manager ?? this.dataSource.manager).getRepository(target);
  }
}

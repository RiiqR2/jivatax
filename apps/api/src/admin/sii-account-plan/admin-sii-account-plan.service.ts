import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../../sii-account-plan/entities/sii-account-plan-version.entity";
import type { ListAdminSiiAccountsQueryDto } from "./admin-sii-account-plan.dto";

@Injectable()
export class AdminSiiAccountPlanService {
  constructor(
    @InjectRepository(SiiAccountPlanVersionEntity)
    private readonly versions: Repository<SiiAccountPlanVersionEntity>,
    @InjectRepository(SiiAccountEntity)
    private readonly accounts: Repository<SiiAccountEntity>,
  ) {}

  async listVersions() {
    const versions = await this.versions
      .createQueryBuilder("version")
      .loadRelationCountAndMap("version.accountCount", "version.accounts")
      .orderBy("version.importedAt", "DESC")
      .getMany();

    return versions.map((version) => ({
      id: version.id,
      code: version.code,
      name: version.name,
      accountCount: (
        version as SiiAccountPlanVersionEntity & { accountCount: number }
      ).accountCount,
      createdAt: version.createdAt,
    }));
  }

  async listAccounts(versionId: string, query: ListAdminSiiAccountsQueryDto) {
    const versionExists = await this.versions.existsBy({ id: versionId });
    if (!versionExists) {
      throw new NotFoundException("Versión del plan de cuentas no encontrada.");
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const builder = this.accounts
      .createQueryBuilder("account")
      .where("account.versionId = :versionId", { versionId });

    if (query.search?.trim()) {
      builder.andWhere(
        new Brackets((where) => {
          where
            .where("account.code LIKE :search")
            .orWhere("account.name LIKE :search");
        }),
        { search: `%${query.search.trim()}%` },
      );
    }

    const [accounts, total] = await builder
      .orderBy("account.sortOrder", "ASC")
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: accounts.map((account) => ({
        id: account.id,
        code: account.code,
        name: account.name,
        sortOrder: account.sortOrder,
      })),
      total,
      page,
      limit,
    };
  }
}

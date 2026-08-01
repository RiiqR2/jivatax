import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, Repository } from "typeorm";
import type { ListSiiAccountsQueryDto } from "../dto/list-sii-accounts-query.dto";
import { SiiAccountEntity } from "../entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../entities/sii-account-plan-version.entity";
import { CurrentSiiAccountCatalogService } from "./current-sii-account-catalog.service";

@Injectable()
export class SiiAccountPlanService {
  constructor(
    @InjectRepository(SiiAccountPlanVersionEntity)
    private readonly versions: Repository<SiiAccountPlanVersionEntity>,
    @InjectRepository(SiiAccountEntity)
    private readonly accounts: Repository<SiiAccountEntity>,
    private readonly currentCatalog: CurrentSiiAccountCatalogService,
  ) {}

  async listVersions() {
    const versions = await this.versions
      .createQueryBuilder("version")
      .loadRelationCountAndMap("version.accountCount", "version.accounts")
      .orderBy("version.importedAt", "DESC")
      .getMany();

    return {
      items: versions.map((version) => ({
        id: version.id,
        code: version.code,
        name: version.name,
        status: version.status,
        effectiveFrom: version.effectiveFrom,
        effectiveTo: version.effectiveTo,
        importedAt: version.importedAt,
        sourceFileName: version.sourceFileName,
        accountCount: (
          version as SiiAccountPlanVersionEntity & {
            accountCount: number;
          }
        ).accountCount,
      })),
    };
  }

  async listAccounts(query: ListSiiAccountsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const builder = this.accounts.createQueryBuilder("account");
    const versionId = await this.currentCatalog.getVersionId();
    builder.andWhere("account.versionId = :versionId", { versionId });
    if (query.code) {
      builder.andWhere("account.code = :code", {
        code: query.code,
      });
    }
    if (query.parentId) {
      builder.andWhere("account.parentId = :parentId", {
        parentId: query.parentId,
      });
    }
    if (query.level !== undefined) {
      builder.andWhere("account.level = :level", {
        level: query.level,
      });
    }
    if (query.search) {
      builder.andWhere(
        new Brackets((searchBuilder) => {
          searchBuilder
            .where("account.code LIKE :search")
            .orWhere("account.name LIKE :search")
            .orWhere("account.description LIKE :search");
        }),
        {
          search: `%${query.search}%`,
        },
      );
    }

    const [accounts, total] = await builder
      .orderBy("account.sortOrder", "ASC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: accounts.map((account) => this.presentAccount(account)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getAccount(accountId: string) {
    const account = await this.accounts.findOne({
      where: {
        id: accountId,
      },
    });
    if (!account) {
      throw new NotFoundException("Cuenta SII no encontrada.");
    }
    return this.presentAccount(account);
  }

  async findActiveByCode(code: string): Promise<SiiAccountEntity | null> {
    const normalizedCode = code.trim();
    if (!normalizedCode) return null;
    const versionId = await this.currentCatalog.getVersionId();
    if (!versionId) return null;
    return this.accounts.findOneBy({ code: normalizedCode, versionId });
  }

  private presentAccount(account: SiiAccountEntity) {
    return {
      id: account.id,
      versionId: account.versionId,
      code: account.code,
      name: account.name,
      description: account.description,
      level: account.level,
      parentId: account.parentId,
      isPostable: null,
      sortOrder: account.sortOrder,
      sourceRowNumber: account.sourceRowNumber,
    };
  }
}

import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Brackets, DataSource, IsNull, Repository } from "typeorm";
import * as XLSX from "xlsx";
import { CompanyEntity } from "../../companies/entities/company.entity";
import {
  StoredFileCategory,
  StoredFileEntity,
  StoredFileStatus,
} from "../../files/entities/stored-file.entity";
import {
  OBJECT_STORAGE,
  ObjectStorageService,
} from "../../files/storage/object-storage.service";
import { OrganizationMemberEntity } from "../../organizations/entities/organization-member.entity";
import { OrganizationMemberStatus } from "../../organizations/enums/organization-member-status.enum";
import { OrganizationRole } from "../../organizations/enums/organization-role.enum";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import {
  AssignCompanyAccountMappingDto,
  ImportCompanyAccountPlanDto,
  ListCompanyAccountsQueryDto,
  ReviewCompanyAccountMappingDto,
} from "../dto/company-account-plan.dto";
import { CompanyAccountMappingEntity } from "../entities/company-account-mapping.entity";
import { CompanyAccountPlanVersionEntity } from "../entities/company-account-plan-version.entity";
import { CompanyAccountEntity } from "../entities/company-account.entity";
import {
  CompanyAccountMappingMethod,
  CompanyAccountMappingStatus,
  CompanyAccountPlanVersionStatus,
  CompanyAccountStatus,
} from "../enums/company-account-plan.enums";
import { CompanyAccountMatchingService } from "./company-account-matching.service";
import { CompanyAccountPlanParserService } from "./company-account-plan-parser.service";
import { CompanyAccountPlanTemplateService } from "./company-account-plan-template.service";
import { ACCOUNT_PLAN_FILE_CONTRACT } from "../company-account-plan.contract";

const READ_ROLES = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.ACCOUNTANT,
  OrganizationRole.AUDITOR,
];
const WRITE_ROLES = [
  OrganizationRole.OWNER,
  OrganizationRole.ADMIN,
  OrganizationRole.ACCOUNTANT,
];
const ALLOWED_CONTENT_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
];

@Injectable()
export class CompanyAccountPlanService {
  constructor(
    @InjectRepository(CompanyAccountPlanVersionEntity)
    private readonly versions: Repository<CompanyAccountPlanVersionEntity>,
    @InjectRepository(CompanyAccountEntity)
    private readonly accounts: Repository<CompanyAccountEntity>,
    @InjectRepository(CompanyAccountMappingEntity)
    private readonly mappings: Repository<CompanyAccountMappingEntity>,
    @InjectRepository(StoredFileEntity)
    private readonly storedFiles: Repository<StoredFileEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companies: Repository<CompanyEntity>,
    @InjectRepository(OrganizationMemberEntity)
    private readonly members: Repository<OrganizationMemberEntity>,
    private readonly dataSource: DataSource,
    private readonly parser: CompanyAccountPlanParserService,
    private readonly matching: CompanyAccountMatchingService,
    private readonly template: CompanyAccountPlanTemplateService,
    @Inject(OBJECT_STORAGE)
    private readonly storage: ObjectStorageService,
  ) {}

  async getTemplate(
    companyId: string,
    organizationId: string,
    userId: string,
  ): Promise<Buffer> {
    await this.assertAccess(companyId, organizationId, userId, READ_ROLES);
    return this.template.generate();
  }

  async listVersions(
    companyId: string,
    organizationId: string,
    userId: string,
  ) {
    await this.assertAccess(companyId, organizationId, userId, READ_ROLES);
    const versions = await this.versions.find({
      where: {
        companyId,
      },
      order: {
        createdAt: "DESC",
      },
    });
    return {
      items: versions.map((version) => this.presentVersion(version)),
    };
  }

  async importPlan(
    companyId: string,
    organizationId: string,
    userId: string,
    dto: ImportCompanyAccountPlanDto,
  ) {
    await this.assertAccess(companyId, organizationId, userId, WRITE_ROLES);
    const file = await this.storedFiles.findOneBy({
      id: dto.storedFileId,
      companyId,
      category: StoredFileCategory.COMPANY_ACCOUNT_PLAN,
      status: StoredFileStatus.UPLOADED,
    });
    if (!file) {
      throw new BadRequestException(
        "El archivo no existe, no pertenece a la empresa o no está disponible.",
      );
    }
    this.validateFile(file);
    const buffer = await this.storage.getObject(file.bucket, file.objectKey);
    const checksum = createHash("sha256").update(buffer).digest("hex");
    if (
      await this.versions.existsBy({
        companyId,
        sourceChecksum: checksum,
      })
    ) {
      throw new ConflictException(
        "Este archivo ya fue importado para la empresa.",
      );
    }
    const version = await this.versions.save(
      this.versions.create({
        companyId,
        name: dto.name.trim(),
        sourceFileName: file.originalName,
        sourceChecksum: checksum,
        status: CompanyAccountPlanVersionStatus.PROCESSING,
        importedAt: null,
        processedAt: null,
        failureReason: null,
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        createdByUserId: userId,
        updatedByUserId: userId,
      }),
    );
    try {
      const workbook = this.parser.inspectFile(buffer, file.extension);
      const sheet = this.parser.detectSheet(workbook);
      const sheetRows = this.getSheetRows(sheet);
      const headerRow = this.parser.detectHeaderRow(sheetRows);
      const columns = this.parser.detectColumns(sheetRows[headerRow]);
      const rawRows = this.parser.parseRows(sheet, headerRow);
      const normalizedRows = this.parser.normalizeRows(rawRows, columns);
      const validated = this.parser.validateRows(normalizedRows);
      const resolvedRows = this.parser.resolveHierarchy(validated.rows);
      let ambiguousMappings = 0;
      await this.dataSource.transaction(async (manager) => {
        const companyAccounts = await manager.save(
          CompanyAccountEntity,
          resolvedRows.map((row) =>
            manager.create(CompanyAccountEntity, {
              companyAccountPlanVersionId: version.id,
              companyId,
              internalCode: row.internalCode,
              name: row.name,
              description: row.description,
              level: row.level,
              parentId: null,
              sortOrder: row.sortOrder,
              sourceRowNumber: row.sourceRowNumber,
              rawData: row.rawData,
              status:
                row.status === "inactive"
                  ? CompanyAccountStatus.INACTIVE
                  : CompanyAccountStatus.ACTIVE,
            }),
          ),
        );
        const accountsByCode = new Map(
          companyAccounts.map((account) => [account.internalCode, account]),
        );
        for (const account of companyAccounts) {
          const sourceRow = resolvedRows.find(
            (row) => row.internalCode === account.internalCode,
          );
          if (sourceRow?.parentCode) {
            account.parentId =
              accountsByCode.get(sourceRow.parentCode)?.id ?? null;
          }
        }
        await manager.save(CompanyAccountEntity, companyAccounts);
        ambiguousMappings = await this.matching.generateMappingSuggestions(
          manager,
          companyAccounts,
        );
        version.status = CompanyAccountPlanVersionStatus.READY;
        version.importedAt = new Date();
        version.processedAt = new Date();
        version.totalRows = validated.report.totalRows;
        version.validRows = validated.report.validRows;
        version.invalidRows = validated.report.invalidRows;
        await manager.save(CompanyAccountPlanVersionEntity, version);
      });
      return {
        versionId: version.id,
        status: CompanyAccountPlanVersionStatus.READY,
        report: {
          totalRows: version.totalRows,
          validRows: version.validRows,
          invalidRows: version.invalidRows,
          ambiguousMappings,
        },
      };
    } catch (error: unknown) {
      version.status = CompanyAccountPlanVersionStatus.FAILED;
      version.processedAt = new Date();
      version.failureReason = this.publicFailureReason(error);
      version.updatedByUserId = userId;
      await this.versions.save(version);
      throw error;
    }
  }

  async getVersion(
    companyId: string,
    versionId: string,
    organizationId: string,
    userId: string,
  ) {
    await this.assertAccess(companyId, organizationId, userId, READ_ROLES);
    const version = await this.getOwnedVersion(companyId, versionId);
    const counts = await this.mappings
      .createQueryBuilder("mapping")
      .innerJoin("mapping.companyAccount", "account")
      .select("mapping.status", "status")
      .addSelect("COUNT(*)", "count")
      .where("account.companyAccountPlanVersionId = :versionId", { versionId })
      .groupBy("mapping.status")
      .getRawMany<{ status: CompanyAccountMappingStatus; count: string }>();
    return {
      ...this.presentVersion(version),
      mappingCounts: Object.fromEntries(
        counts.map((count) => [count.status, Number(count.count)]),
      ),
    };
  }

  async listAccounts(
    companyId: string,
    versionId: string,
    organizationId: string,
    userId: string,
    query: ListCompanyAccountsQueryDto,
  ) {
    await this.assertAccess(companyId, organizationId, userId, READ_ROLES);
    await this.getOwnedVersion(companyId, versionId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const builder = this.accounts
      .createQueryBuilder("account")
      .leftJoinAndSelect("account.mapping", "mapping")
      .leftJoinAndMapOne(
        "mapping.siiAccount",
        SiiAccountEntity,
        "siiAccount",
        "siiAccount.id = mapping.siiAccountId",
      )
      .where("account.companyId = :companyId", { companyId })
      .andWhere("account.companyAccountPlanVersionId = :versionId", {
        versionId,
      });
    if (query.search?.trim()) {
      builder.andWhere(
        new Brackets((search) => {
          search
            .where("account.internalCode LIKE :search")
            .orWhere("account.name LIKE :search")
            .orWhere("account.description LIKE :search");
        }),
        { search: `%${query.search.trim()}%` },
      );
    }
    if (query.mappingStatus) {
      builder.andWhere("mapping.status = :mappingStatus", {
        mappingStatus: query.mappingStatus,
      });
    }
    if (query.mappingMethod) {
      builder.andWhere("mapping.mappingMethod = :mappingMethod", {
        mappingMethod: query.mappingMethod,
      });
    }
    if (query.minConfidence !== undefined) {
      builder.andWhere("mapping.confidence >= :minConfidence", {
        minConfidence: query.minConfidence,
      });
    }
    const [items, total] = await builder
      .orderBy("account.sortOrder", "ASC")
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return {
      items: items.map((account) => this.presentAccount(account)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getAccount(
    companyId: string,
    accountId: string,
    organizationId: string,
    userId: string,
  ) {
    await this.assertAccess(companyId, organizationId, userId, READ_ROLES);
    const account = await this.accounts.findOne({
      where: { id: accountId, companyId },
      relations: { mapping: { siiAccount: true } },
    });
    if (!account) {
      throw new NotFoundException("Cuenta interna no encontrada.");
    }
    return this.presentAccount(account);
  }

  async listMappings(
    companyId: string,
    versionId: string,
    organizationId: string,
    userId: string,
    query: ListCompanyAccountsQueryDto,
  ) {
    return this.listAccounts(
      companyId,
      versionId,
      organizationId,
      userId,
      query,
    );
  }

  async assignMapping(
    companyId: string,
    mappingId: string,
    organizationId: string,
    userId: string,
    dto: AssignCompanyAccountMappingDto,
  ) {
    const mapping = await this.getWritableMapping(
      companyId,
      mappingId,
      organizationId,
      userId,
    );
    if (
      !(await this.dataSource
        .getRepository(SiiAccountEntity)
        .existsBy({ id: dto.siiAccountId }))
    ) {
      throw new BadRequestException("La cuenta SII seleccionada no existe.");
    }
    mapping.siiAccountId = dto.siiAccountId;
    mapping.status = CompanyAccountMappingStatus.CONFIRMED;
    mapping.mappingMethod = CompanyAccountMappingMethod.MANUAL;
    mapping.confidence = null;
    mapping.notes = dto.notes?.trim() || null;
    this.markReviewed(mapping, userId);
    return this.presentMapping(await this.mappings.save(mapping));
  }

  async confirmMapping(
    companyId: string,
    mappingId: string,
    organizationId: string,
    userId: string,
    dto: ReviewCompanyAccountMappingDto,
  ) {
    const mapping = await this.getWritableMapping(
      companyId,
      mappingId,
      organizationId,
      userId,
    );
    if (!mapping.siiAccountId) {
      throw new BadRequestException(
        "La correspondencia no tiene una cuenta SII sugerida.",
      );
    }
    mapping.status = CompanyAccountMappingStatus.CONFIRMED;
    mapping.notes = dto.notes?.trim() || mapping.notes;
    this.markReviewed(mapping, userId);
    return this.presentMapping(await this.mappings.save(mapping));
  }

  async rejectMapping(
    companyId: string,
    mappingId: string,
    organizationId: string,
    userId: string,
    dto: ReviewCompanyAccountMappingDto,
  ) {
    const mapping = await this.getWritableMapping(
      companyId,
      mappingId,
      organizationId,
      userId,
    );
    mapping.status = CompanyAccountMappingStatus.REJECTED;
    mapping.notes = dto.notes?.trim() || mapping.notes;
    this.markReviewed(mapping, userId);
    return this.presentMapping(await this.mappings.save(mapping));
  }

  async unmap(
    companyId: string,
    mappingId: string,
    organizationId: string,
    userId: string,
  ) {
    const mapping = await this.getWritableMapping(
      companyId,
      mappingId,
      organizationId,
      userId,
    );
    mapping.status = CompanyAccountMappingStatus.UNMAPPED;
    mapping.siiAccountId = null;
    mapping.mappingMethod = CompanyAccountMappingMethod.MANUAL;
    mapping.confidence = null;
    this.markReviewed(mapping, userId);
    return this.presentMapping(await this.mappings.save(mapping));
  }

  private async assertAccess(
    companyId: string,
    organizationId: string,
    userId: string,
    roles: OrganizationRole[],
  ): Promise<void> {
    const [company, member] = await Promise.all([
      this.companies.findOneBy({
        id: companyId,
        organizationId,
        deletedAt: IsNull(),
      }),
      this.members.findOneBy({
        organizationId,
        userId,
        status: OrganizationMemberStatus.ACTIVE,
        deletedAt: IsNull(),
      }),
    ]);
    if (!company || !member || !roles.includes(member.role)) {
      throw new ForbiddenException(
        "No tienes permisos para operar este plan de cuentas.",
      );
    }
  }

  private validateFile(file: StoredFileEntity): void {
    if (
      !ACCOUNT_PLAN_FILE_CONTRACT.allowedExtensions.includes(
        file.extension as "xlsx" | "xls" | "csv",
      ) ||
      !ALLOWED_CONTENT_TYPES.includes(file.contentType)
    ) {
      throw new BadRequestException(
        "El tipo real registrado del archivo no está permitido.",
      );
    }
    if (
      BigInt(file.sizeBytes) >
      BigInt(ACCOUNT_PLAN_FILE_CONTRACT.maximumFileSizeBytes)
    ) {
      throw new BadRequestException(
        "El plan de cuentas supera el máximo de 10 MB.",
      );
    }
  }

  private getSheetRows(sheet: import("xlsx").WorkSheet): unknown[][] {
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: false,
    });
  }

  private async getOwnedVersion(
    companyId: string,
    versionId: string,
  ): Promise<CompanyAccountPlanVersionEntity> {
    const version = await this.versions.findOneBy({ id: versionId, companyId });
    if (!version) {
      throw new NotFoundException("Versión del plan de cuentas no encontrada.");
    }
    return version;
  }

  private async getWritableMapping(
    companyId: string,
    mappingId: string,
    organizationId: string,
    userId: string,
  ): Promise<CompanyAccountMappingEntity> {
    await this.assertAccess(companyId, organizationId, userId, WRITE_ROLES);
    const mapping = await this.mappings
      .createQueryBuilder("mapping")
      .innerJoinAndSelect("mapping.companyAccount", "account")
      .leftJoinAndSelect("mapping.siiAccount", "siiAccount")
      .where("mapping.id = :mappingId", { mappingId })
      .andWhere("account.companyId = :companyId", { companyId })
      .getOne();
    if (!mapping) {
      throw new NotFoundException("Correspondencia no encontrada.");
    }
    return mapping;
  }

  private markReviewed(
    mapping: CompanyAccountMappingEntity,
    userId: string,
  ): void {
    mapping.reviewedByUserId = userId;
    mapping.reviewedAt = new Date();
  }

  private presentVersion(version: CompanyAccountPlanVersionEntity) {
    return {
      id: version.id,
      name: version.name,
      sourceFileName: version.sourceFileName,
      status: version.status,
      totalRows: version.totalRows,
      validRows: version.validRows,
      invalidRows: version.invalidRows,
      importedAt: version.importedAt,
      processedAt: version.processedAt,
      failureReason: version.failureReason,
      createdAt: version.createdAt,
    };
  }

  private presentAccount(account: CompanyAccountEntity) {
    return {
      id: account.id,
      internalCode: account.internalCode,
      name: account.name,
      description: account.description,
      level: account.level,
      parentId: account.parentId,
      status: account.status,
      mapping: account.mapping ? this.presentMapping(account.mapping) : null,
    };
  }

  private presentMapping(mapping: CompanyAccountMappingEntity) {
    return {
      id: mapping.id,
      status: mapping.status,
      method: mapping.mappingMethod,
      confidence:
        mapping.confidence === null ? null : Number(mapping.confidence),
      notes: mapping.notes,
      reviewedByUserId: mapping.reviewedByUserId,
      reviewedAt: mapping.reviewedAt,
      suggestedAt: mapping.suggestedAt,
      siiAccount: mapping.siiAccount
        ? {
            id: mapping.siiAccount.id,
            code: mapping.siiAccount.code,
            name: mapping.siiAccount.name,
          }
        : null,
    };
  }

  private publicFailureReason(error: unknown): string {
    if (
      error instanceof BadRequestException ||
      error instanceof ConflictException
    ) {
      const response = error.getResponse();
      return typeof response === "string"
        ? response
        : "El archivo no superó las validaciones de importación.";
    }
    return "No fue posible procesar el archivo.";
  }
}

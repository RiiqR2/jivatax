import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository, SelectQueryBuilder } from "typeorm";
import type { EntityManager } from "typeorm";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { CompanyAccountEntity } from "../../company-account-plan/entities/company-account.entity";
import { CompanyAccountMappingEntity } from "../../company-account-plan/entities/company-account-mapping.entity";
import {
  CompanyAccountMappingMethod,
  CompanyAccountMappingStatus,
} from "../../company-account-plan/enums/company-account-plan.enums";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountTermEntity } from "../../sii-account-matching/entities/sii-account-term.entity";
import { normalizeAccountTerm } from "../../sii-account-matching/normalization/account-term-normalizer";
import {
  ListPeriodAccountMappingsDto,
  UpdatePeriodAccountMappingDto,
} from "../dto/account-mappings.dto";
import { CompanyAccountMappingHistoryEntity } from "../entities/company-account-mapping-history.entity";
import {
  CompanyAccountSuggestionEntity,
  CompanyAccountSuggestionStatus,
} from "../entities/company-account-suggestion.entity";
import { TaxPeriodCompanyAccountEntity } from "../entities/tax-period-company-account.entity";
import { TaxPeriodsService } from "./tax-periods.service";
import { TaxDocumentEntity } from "../entities/tax-document.entity";
import { TaxDocumentType } from "../enums/accounting.enums";
import { AccountMatchingFeedbackEntity } from "../../sii-account-matching/entities/account-matching-feedback.entity";

type MappingListRow = {
  companyAccountId: string;
  code: string;
  canonicalName: string;
  periodName: string;
  firstSeenTaxPeriodId: string | null;
  lastSeenTaxPeriodId: string | null;
  lastSeenAt: Date | null;
  mappingId: string;
  mappingStatus: CompanyAccountMappingStatus;
  matchMethod: CompanyAccountMappingMethod;
  mappingConfidence: string | null;
  siiAccountId: string | null;
  siiCode: string | null;
  siiName: string | null;
  suggestionId: string | null;
  suggestedSiiAccountId: string | null;
  suggestedSiiCode: string | null;
  suggestedSiiName: string | null;
  suggestionScore: string | null;
  suggestionConfidence: string | null;
  suggestionReasons:
    | Array<{ signal: string; description: string; points: number }>
    | string
    | null;
  suggestionAlgorithmVersion: string | null;
};

type SummaryRow = {
  total: string;
  newInPeriod: string | null;
  nameChanged: string | null;
  suggestedCount: string | null;
  highConfidence: string | null;
  mediumConfidence: string | null;
  lowConfidence: string | null;
};

@Injectable()
export class PeriodAccountMappingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(TaxPeriodCompanyAccountEntity)
    private readonly periodAccounts: Repository<TaxPeriodCompanyAccountEntity>,
    @InjectRepository(CompanyAccountEntity)
    private readonly companyAccounts: Repository<CompanyAccountEntity>,
    @InjectRepository(CompanyAccountMappingHistoryEntity)
    private readonly mappingHistory: Repository<CompanyAccountMappingHistoryEntity>,
    @InjectRepository(CompanyEntity)
    private readonly companies: Repository<CompanyEntity>,
    @InjectRepository(TaxDocumentEntity)
    private readonly documents: Repository<TaxDocumentEntity>,
    private readonly periods: TaxPeriodsService,
  ) {}

  async list(
    companyId: string,
    taxPeriodId: string,
    query: ListPeriodAccountMappingsDto,
  ) {
    const period = await this.periods.get(companyId, taxPeriodId);
    const company = await this.companies.findOneByOrFail({ id: companyId });
    const sourceDocument = query.documentId
      ? await this.documents.findOne({
          where: { id: query.documentId, companyId, taxPeriodId },
          relations: { storedFile: true },
        })
      : await this.documents.findOne({
          where: {
            companyId,
            taxPeriodId,
            documentType: TaxDocumentType.BALANCE,
          },
          relations: { storedFile: true },
          order: { versionNumber: "DESC" },
        });
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const builder = this.createListQuery(companyId, taxPeriodId, query);
    const total = await builder.clone().getCount();
    const rows = await builder
      .select("account.id", "companyAccountId")
      .addSelect("account.internalCode", "code")
      .addSelect("account.name", "canonicalName")
      .addSelect("periodAccount.accountNameSnapshot", "periodName")
      .addSelect("account.firstSeenTaxPeriodId", "firstSeenTaxPeriodId")
      .addSelect("account.lastSeenTaxPeriodId", "lastSeenTaxPeriodId")
      .addSelect("account.lastSeenAt", "lastSeenAt")
      .addSelect("mapping.id", "mappingId")
      .addSelect("mapping.status", "mappingStatus")
      .addSelect("mapping.mappingMethod", "matchMethod")
      .addSelect("mapping.confidence", "mappingConfidence")
      .addSelect("sii.id", "siiAccountId")
      .addSelect("sii.code", "siiCode")
      .addSelect("sii.name", "siiName")
      .addSelect("suggestion.id", "suggestionId")
      .addSelect("suggestedSii.id", "suggestedSiiAccountId")
      .addSelect("suggestedSii.code", "suggestedSiiCode")
      .addSelect("suggestedSii.name", "suggestedSiiName")
      .addSelect("suggestion.score", "suggestionScore")
      .addSelect("suggestion.confidence", "suggestionConfidence")
      .addSelect("suggestion.reasons", "suggestionReasons")
      .addSelect("suggestion.algorithmVersion", "suggestionAlgorithmVersion")
      .orderBy("account.internalCode", "ASC")
      .skip((page - 1) * limit)
      .take(limit)
      .getRawMany<MappingListRow>();

    const statusRows = await this.createBaseQuery(companyId, taxPeriodId)
      .select("mapping.status", "status")
      .addSelect("COUNT(*)", "count")
      .groupBy("mapping.status")
      .getRawMany<{ status: CompanyAccountMappingStatus; count: string }>();
    const counts = new Map(
      statusRows.map((row) => [row.status, Number(row.count)]),
    );
    const summary = await this.createBaseQuery(companyId, taxPeriodId)
      .select("COUNT(*)", "total")
      .addSelect(
        "SUM(account.firstSeenTaxPeriodId = periodAccount.taxPeriodId)",
        "newInPeriod",
      )
      .addSelect(
        "SUM(account.name <> periodAccount.accountNameSnapshot)",
        "nameChanged",
      )
      .addSelect("SUM(suggestion.id IS NOT NULL)", "suggestedCount")
      .addSelect(
        "SUM(suggestion.confidence >= :highConfidence)",
        "highConfidence",
      )
      .addSelect(
        "SUM(suggestion.confidence >= :mediumConfidence AND suggestion.confidence < :highConfidence)",
        "mediumConfidence",
      )
      .addSelect(
        "SUM(suggestion.confidence < :mediumConfidence)",
        "lowConfidence",
      )
      .setParameters({ highConfidence: 0.8, mediumConfidence: 0.55 })
      .getRawOne<SummaryRow>();
    const metrics = summary ?? {
      total: "0",
      newInPeriod: "0",
      nameChanged: "0",
      suggestedCount: "0",
      highConfidence: "0",
      mediumConfidence: "0",
      lowConfidence: "0",
    };

    return {
      items: rows.map((row) =>
        this.presentListRow(row, taxPeriodId, period.taxYear),
      ),
      total,
      page,
      limit,
      context: {
        company: {
          id: company.id,
          legalName: company.legalName,
          taxId: company.rut,
        },
        taxPeriod: {
          id: period.id,
          commercialYear: period.commercialYear,
          taxYear: period.taxYear,
          status: period.status,
        },
        sourceDocument: sourceDocument
          ? {
              id: sourceDocument.id,
              filename: sourceDocument.storedFile.originalName,
              version: sourceDocument.versionNumber,
              processedAt: sourceDocument.processedAt,
            }
          : null,
      },
      summary: {
        total:
          (counts.get(CompanyAccountMappingStatus.CONFIRMED) ?? 0) +
          (counts.get(CompanyAccountMappingStatus.PENDING) ?? 0),
        pending: counts.get(CompanyAccountMappingStatus.PENDING) ?? 0,
        suggested: Number(metrics.suggestedCount ?? 0),
        confirmed: counts.get(CompanyAccountMappingStatus.CONFIRMED) ?? 0,
        rejected: counts.get(CompanyAccountMappingStatus.REJECTED) ?? 0,
        newInPeriod: Number(metrics.newInPeriod ?? 0),
        nameChanged: Number(metrics.nameChanged ?? 0),
        withoutSuggestion:
          (counts.get(CompanyAccountMappingStatus.PENDING) ?? 0) -
          Number(metrics.suggestedCount ?? 0),
        highConfidence: Number(metrics.highConfidence ?? 0),
        mediumConfidence: Number(metrics.mediumConfidence ?? 0),
        lowConfidence: Number(metrics.lowConfidence ?? 0),
      },
    };
  }

  private createBaseQuery(companyId: string, taxPeriodId: string) {
    return this.periodAccounts
      .createQueryBuilder("periodAccount")
      .innerJoin("periodAccount.companyAccount", "account")
      .innerJoin("account.mapping", "mapping")
      .leftJoin("mapping.siiAccount", "sii")
      .leftJoin(
        CompanyAccountSuggestionEntity,
        "suggestion",
        "suggestion.companyAccountId = account.id AND mapping.status = :pendingMappingStatus AND suggestion.status = :activeSuggestionStatus AND suggestion.suggestionRank = :primaryRank",
        {
          pendingMappingStatus: CompanyAccountMappingStatus.PENDING,
          activeSuggestionStatus: CompanyAccountSuggestionStatus.ACTIVE,
          primaryRank: 1,
        },
      )
      .leftJoin("suggestion.siiAccount", "suggestedSii")
      .where("periodAccount.companyId = :companyId", { companyId })
      .andWhere("periodAccount.taxPeriodId = :taxPeriodId", { taxPeriodId });
  }

  private createListQuery(
    companyId: string,
    taxPeriodId: string,
    query: ListPeriodAccountMappingsDto,
  ): SelectQueryBuilder<TaxPeriodCompanyAccountEntity> {
    const builder = this.createBaseQuery(companyId, taxPeriodId);
    if (query.documentId)
      builder.andWhere("periodAccount.sourceDocumentId = :documentId", {
        documentId: query.documentId,
      });
    if (query.status === "suggested")
      builder
        .andWhere("mapping.status = :mappingStatus", {
          mappingStatus: CompanyAccountMappingStatus.PENDING,
        })
        .andWhere("suggestion.id IS NOT NULL");
    else if (query.status === "withoutSuggestion")
      builder
        .andWhere("mapping.status = :mappingStatus", {
          mappingStatus: CompanyAccountMappingStatus.PENDING,
        })
        .andWhere("suggestion.id IS NULL");
    else if (query.status)
      builder.andWhere("mapping.status = :mappingStatus", {
        mappingStatus: query.status,
      });
    if (query.newInPeriod)
      builder.andWhere(
        "account.firstSeenTaxPeriodId = periodAccount.taxPeriodId",
      );
    if (query.nameChanged)
      builder.andWhere("account.name <> periodAccount.accountNameSnapshot");
    if (query.search?.trim()) {
      builder.andWhere(
        "(account.internalCode LIKE :search OR account.name LIKE :search OR periodAccount.accountNameSnapshot LIKE :search OR sii.code LIKE :search OR sii.name LIKE :search)",
        { search: `%${query.search.trim()}%` },
      );
    }
    return builder;
  }

  private presentListRow(
    row: MappingListRow,
    taxPeriodId: string,
    taxYear: number,
  ) {
    const reasons =
      typeof row.suggestionReasons === "string"
        ? JSON.parse(row.suggestionReasons)
        : row.suggestionReasons;
    return {
      companyAccountId: row.companyAccountId,
      code: row.code,
      canonicalName: row.canonicalName,
      periodName: row.periodName,
      firstSeenTaxYear:
        row.firstSeenTaxPeriodId === taxPeriodId ? taxYear : null,
      lastSeenTaxYear: row.lastSeenTaxPeriodId === taxPeriodId ? taxYear : null,
      lastSeenAt: row.lastSeenAt,
      usedInPeriod: true,
      isNewInPeriod: row.firstSeenTaxPeriodId === taxPeriodId,
      nameChanged: row.canonicalName !== row.periodName,
      mapping: {
        id: row.mappingId,
        status: row.mappingStatus,
        matchMethod: row.matchMethod,
        confidence:
          row.mappingConfidence === null ? null : Number(row.mappingConfidence),
        siiAccount: row.siiAccountId
          ? { id: row.siiAccountId, code: row.siiCode, name: row.siiName }
          : null,
      },
      suggestions: row.suggestionId
        ? [
            {
              id: row.suggestionId,
              siiAccount: {
                id: row.suggestedSiiAccountId,
                code: row.suggestedSiiCode,
                name: row.suggestedSiiName,
              },
              score: Number(row.suggestionScore),
              confidence: Number(row.suggestionConfidence),
              algorithmVersion: row.suggestionAlgorithmVersion,
              reasons: reasons ?? [],
            },
          ]
        : [],
    };
  }

  async update(
    companyId: string,
    accountId: string,
    userId: string,
    dto: UpdatePeriodAccountMappingDto,
  ) {
    return this.dataSource.transaction(async (manager) => {
      return this.applyMappingDecision(
        manager,
        companyId,
        accountId,
        userId,
        dto,
      );
    });
  }

  private async applyMappingDecision(
    manager: EntityManager,
    companyId: string,
    accountId: string,
    userId: string,
    dto: UpdatePeriodAccountMappingDto,
  ) {
    const mappings = manager.getRepository(CompanyAccountMappingEntity);
    const mapping = await mappings.findOne({
      where: { companyAccountId: accountId, companyAccount: { companyId } },
      relations: { companyAccount: true },
    });
    if (!mapping) throw new NotFoundException("Homologación no encontrada.");
    const siiAccounts = manager.getRepository(SiiAccountEntity);
    if (
      dto.action === "confirm" &&
      !(await siiAccounts.findOne({ where: { id: dto.siiAccountId } }))
    )
      throw new BadRequestException("La cuenta SII seleccionada no existe.");

    const nextStatus =
      dto.action === "confirm"
        ? CompanyAccountMappingStatus.CONFIRMED
        : CompanyAccountMappingStatus.REJECTED;
    const nextSiiAccountId =
      dto.action === "confirm" ? dto.siiAccountId! : mapping.siiAccountId;
    const historyRepository = manager.getRepository(
      CompanyAccountMappingHistoryEntity,
    );
    await historyRepository.save(
      historyRepository.create({
        companyAccountId: accountId,
        previousSiiAccountId: mapping.siiAccountId,
        newSiiAccountId: nextSiiAccountId,
        previousStatus: mapping.status,
        newStatus: nextStatus,
        changedByUserId: userId,
        reason:
          dto.action === "confirm"
            ? "Confirmación manual"
            : "Sugerencia rechazada",
      }),
    );

    mapping.siiAccountId = nextSiiAccountId;
    mapping.status = nextStatus;
    mapping.mappingMethod = CompanyAccountMappingMethod.MANUAL;
    mapping.confidence = null;
    mapping.reviewedByUserId = userId;
    mapping.reviewedAt = new Date();
    await mappings.save(mapping);

    const suggestions = manager.getRepository(CompanyAccountSuggestionEntity);
    const suggestion = await suggestions.findOne({
      where: {
        companyAccountId: accountId,
        status: CompanyAccountSuggestionStatus.ACTIVE,
        suggestionRank: 1,
      },
    });
    if (suggestion) {
      suggestion.status =
        dto.action === "confirm" && dto.siiAccountId === suggestion.siiAccountId
          ? CompanyAccountSuggestionStatus.ACCEPTED
          : CompanyAccountSuggestionStatus.REJECTED;
      suggestion.reviewedByUserId = userId;
      suggestion.reviewedAt = new Date();
      await suggestions.save(suggestion);
      if (suggestion.status === CompanyAccountSuggestionStatus.ACCEPTED) {
        await suggestions.update(
          {
            companyAccountId: accountId,
            status: CompanyAccountSuggestionStatus.ACTIVE,
          },
          {
            status: CompanyAccountSuggestionStatus.SUPERSEDED,
            reviewedByUserId: userId,
            reviewedAt: suggestion.reviewedAt,
          },
        );
      }
    }
    if (dto.action === "confirm") {
      const selected = await suggestions.findOne({
        where: { companyAccountId: accountId, siiAccountId: dto.siiAccountId },
      });
      const feedback = manager.getRepository(AccountMatchingFeedbackEntity);
      await feedback.save(
        feedback.create({
          companyId,
          taxPeriodId: null,
          normalizedName: normalizeAccountTerm(mapping.companyAccount.name),
          siiAccountId: dto.siiAccountId!,
          originalScore: selected?.score ?? null,
          candidatePosition: selected?.suggestionRank ?? null,
          algorithm: selected?.algorithmVersion ?? "manual",
          accepted: selected?.siiAccountId === dto.siiAccountId,
          corrected: Boolean(
            suggestion && suggestion.siiAccountId !== dto.siiAccountId,
          ),
        }),
      );
    }
    if (dto.action === "confirm")
      await this.createCompanyAlias(
        manager.getRepository(SiiAccountTermEntity),
        mapping.companyAccount,
        dto.siiAccountId!,
      );
    return {
      id: mapping.id,
      status: nextStatus,
      siiAccountId: nextSiiAccountId,
    };
  }

  async approveBatch(
    companyId: string,
    taxPeriodId: string,
    userId: string,
    companyAccountIds: string[],
  ) {
    await this.periods.get(companyId, taxPeriodId);
    const ids = [...new Set(companyAccountIds)].slice(0, 100);
    return this.dataSource.transaction(async (manager) => {
      const results = [];
      for (const companyAccountId of ids) {
        const belongs = await manager
          .getRepository(TaxPeriodCompanyAccountEntity)
          .existsBy({
            companyId,
            taxPeriodId,
            companyAccountId,
          });
        if (!belongs) {
          results.push({
            companyAccountId,
            status: "skipped",
            reason: "account_not_in_company_period",
          });
          continue;
        }
        const mapping = await manager
          .getRepository(CompanyAccountMappingEntity)
          .findOneBy({ companyAccountId });
        if (mapping?.status !== CompanyAccountMappingStatus.PENDING) {
          results.push({
            companyAccountId,
            status: "skipped",
            reason: "mapping_not_pending",
          });
          continue;
        }
        const suggestion = await manager
          .getRepository(CompanyAccountSuggestionEntity)
          .findOneBy({
            companyAccountId,
            status: CompanyAccountSuggestionStatus.ACTIVE,
            suggestionRank: 1,
          });
        if (!suggestion) {
          results.push({
            companyAccountId,
            status: "skipped",
            reason: "active_primary_suggestion_not_found",
          });
          continue;
        }
        await this.applyMappingDecision(
          manager,
          companyId,
          companyAccountId,
          userId,
          {
            action: "confirm",
            siiAccountId: suggestion.siiAccountId,
          },
        );
        results.push({
          companyAccountId,
          status: "approved",
          siiAccountId: suggestion.siiAccountId,
        });
      }
      return {
        requested: ids.length,
        approved: results.filter((result) => result.status === "approved")
          .length,
        skipped: results.filter((result) => result.status === "skipped").length,
        results,
      };
    });
  }

  private async createCompanyAlias(
    terms: Repository<SiiAccountTermEntity>,
    account: CompanyAccountEntity,
    siiAccountId: string,
  ): Promise<void> {
    const normalizedTerm = normalizeAccountTerm(account.name);
    if (!normalizedTerm) return;
    const identity = {
      siiAccountId,
      companyId: account.companyId,
      scope: "company" as const,
      normalizedTerm,
      type: "alias" as const,
      source: "company_confirmation",
    };
    if (await terms.findOne({ where: identity })) return;
    await terms.save(
      terms.create({
        ...identity,
        term: account.name,
        weight: 60,
        active: true,
      }),
    );
  }

  async history(companyId: string, accountId: string) {
    if (
      !(await this.companyAccounts.findOne({
        where: { id: accountId, companyId },
      }))
    )
      throw new NotFoundException("Cuenta interna no encontrada.");
    const histories = await this.mappingHistory.find({
      where: { companyAccountId: accountId },
      relations: {
        previousSiiAccount: true,
        newSiiAccount: true,
        changedByUser: true,
      },
      order: { createdAt: "DESC" },
    });
    return {
      items: histories.map((history) => ({
        id: history.id,
        changedAt: history.createdAt,
        previousStatus: history.previousStatus,
        newStatus: history.newStatus,
        reason: history.reason,
        previousCode: history.previousSiiAccount?.code ?? null,
        previousName: history.previousSiiAccount?.name ?? null,
        newCode: history.newSiiAccount?.code ?? null,
        newName: history.newSiiAccount?.name ?? null,
        user: {
          name: `${history.changedByUser.firstName} ${history.changedByUser.lastName}`.trim(),
          email: history.changedByUser.email,
        },
      })),
    };
  }
}

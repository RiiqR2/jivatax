import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository, SelectQueryBuilder } from "typeorm";
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
    private readonly periods: TaxPeriodsService,
  ) {}

  async list(
    companyId: string,
    taxPeriodId: string,
    query: ListPeriodAccountMappingsDto,
  ) {
    const period = await this.periods.get(companyId, taxPeriodId);
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
      summary: {
        total: Number(metrics.total),
        pending: counts.get(CompanyAccountMappingStatus.PENDING) ?? 0,
        suggested: Number(metrics.suggestedCount ?? 0),
        confirmed: counts.get(CompanyAccountMappingStatus.CONFIRMED) ?? 0,
        rejected: counts.get(CompanyAccountMappingStatus.REJECTED) ?? 0,
        newInPeriod: Number(metrics.newInPeriod ?? 0),
        nameChanged: Number(metrics.nameChanged ?? 0),
        withoutSuggestion:
          Number(metrics.total) - Number(metrics.suggestedCount ?? 0),
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
        "suggestion.companyAccountId = account.id AND suggestion.status = :activeSuggestionStatus AND suggestion.suggestionRank = :primaryRank",
        {
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
    if (query.status)
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
          dto.action === "confirm" &&
          dto.siiAccountId === suggestion.siiAccountId
            ? CompanyAccountSuggestionStatus.ACCEPTED
            : CompanyAccountSuggestionStatus.REJECTED;
        suggestion.reviewedByUserId = userId;
        suggestion.reviewedAt = new Date();
        await suggestions.save(suggestion);
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

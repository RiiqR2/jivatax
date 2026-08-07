import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, IsNull } from "typeorm";
import { CompanyAccountMappingHistoryEntity } from "../../accounting/entities/company-account-mapping-history.entity";
import { TaxDocumentEntity } from "../../accounting/entities/tax-document.entity";
import { TaxPeriodCompanyAccountEntity } from "../../accounting/entities/tax-period-company-account.entity";
import { TaxPeriodEntity } from "../../accounting/entities/tax-period.entity";
import { TaxDocumentType } from "../../accounting/enums/accounting.enums";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { CompanyAccountMappingEntity } from "../../company-account-plan/entities/company-account-mapping.entity";
import { CompanyAccountEntity } from "../../company-account-plan/entities/company-account.entity";
import { CompanyAccountMappingStatus } from "../../company-account-plan/enums/company-account-plan.enums";
import { CurrentSiiAccountCatalogService } from "../../sii-account-plan/services/current-sii-account-catalog.service";
import type {
  CatalogTermEvidence,
  ConfirmedMappingEvidence,
  MatchingResolutionContext,
} from "../pipeline/account-matching-pipeline.types";
import { SiiAccountTermEntity } from "../entities/sii-account-term.entity";

export interface MatchingResolutionContextRequest {
  companyId: string;
  taxPeriodId: string;
  companyAccountId: string;
  /** Required until the domain exposes one unambiguous selected closing balance. */
  balanceImportId: string;
}

/** Read-only production adapter. It assembles evidence but never resolves or writes mappings. */
@Injectable()
export class MatchingResolutionContextFactoryService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly currentCatalog: CurrentSiiAccountCatalogService,
  ) {}

  async create(
    input: MatchingResolutionContextRequest,
  ): Promise<MatchingResolutionContext> {
    if (!input.balanceImportId)
      throw new BadRequestException("balanceImportId is required");
    const manager = this.dataSource.manager;
    const [account, period, company, document] = await Promise.all([
      manager.getRepository(CompanyAccountEntity).findOneBy({
        id: input.companyAccountId,
        companyId: input.companyId,
      }),
      manager.getRepository(TaxPeriodEntity).findOneBy({
        id: input.taxPeriodId,
        companyId: input.companyId,
      }),
      manager.getRepository(CompanyEntity).findOne({
        select: { id: true, industryId: true },
        where: { id: input.companyId },
      }),
      manager.getRepository(TaxDocumentEntity).findOneBy({
        id: input.balanceImportId,
        companyId: input.companyId,
        taxPeriodId: input.taxPeriodId,
        documentType: TaxDocumentType.BALANCE,
      }),
    ]);
    if (!account)
      throw new NotFoundException("company account is outside company context");
    if (!period || !company)
      throw new NotFoundException("tax period is outside company context");
    if (!document || document.discardedAt)
      throw new NotFoundException("balance import is outside period context");

    const snapshot = await manager
      .getRepository(TaxPeriodCompanyAccountEntity)
      .findOneBy({
        companyId: input.companyId,
        taxPeriodId: input.taxPeriodId,
        companyAccountId: input.companyAccountId,
        sourceDocumentId: input.balanceImportId,
        discardedAt: IsNull(),
      });
    if (!snapshot)
      throw new NotFoundException(
        "account snapshot is not present in selected balance",
      );

    const [catalogAccounts, mapping, history, terms] = await Promise.all([
      this.currentCatalog.findAccounts(manager),
      manager.getRepository(CompanyAccountMappingEntity).findOne({
        where: { companyAccountId: input.companyAccountId },
        relations: { siiAccount: true },
      }),
      manager.getRepository(CompanyAccountMappingHistoryEntity).find({
        where: {
          companyAccountId: input.companyAccountId,
          newStatus: CompanyAccountMappingStatus.CONFIRMED,
        },
        relations: { newSiiAccount: true },
        order: { createdAt: "DESC" },
      }),
      manager.getRepository(SiiAccountTermEntity).find({
        where: [
          { scope: "global", active: true },
          { scope: "company", companyId: input.companyId, active: true },
        ],
        relations: { siiAccount: true },
      }),
    ]);
    const currentIds = new Set(catalogAccounts.map((item) => item.id));
    const parentCodes = new Map(
      catalogAccounts.map((item) => [item.id, item.code]),
    );
    const confirmedMapping = this.toConfirmedMapping(
      mapping,
      input.companyAccountId,
    );
    const historicalCompanyMappings = history
      .filter(
        (item) =>
          item.newSiiAccount &&
          item.newSiiAccountId !== confirmedMapping?.siiAccountId,
      )
      .map((item) => ({
        companyAccountId: item.companyAccountId,
        siiAccountId: item.newSiiAccount!.id,
        siiCode: item.newSiiAccount!.code,
        siiName: item.newSiiAccount!.name,
        confirmedAt: item.createdAt,
        source: item.reason ?? "mapping_history",
      }));
    const applicableTerms = terms.filter((term) =>
      currentIds.has(term.siiAccountId),
    );
    const companyAliases = applicableTerms
      .filter(
        (term) =>
          term.active &&
          term.scope === "company" &&
          term.type === "alias" &&
          term.companyId === input.companyId,
      )
      .map((term) => ({
        normalizedTerm: term.normalizedTerm,
        siiAccountId: term.siiAccountId,
        siiCode: term.siiAccount.code,
        siiName: term.siiAccount.name,
        active: term.active,
      }));

    return {
      companyId: input.companyId,
      industryId: company.industryId ?? undefined,
      companyAccountId: input.companyAccountId,
      accountObservation: {
        accountCode: snapshot.accountCodeSnapshot,
        accountName: snapshot.accountNameSnapshot,
        assetAmount: snapshot.assetAmount,
        liabilityAmount: snapshot.liabilityAmount,
        lossAmount: snapshot.lossAmount,
        gainAmount: snapshot.gainAmount,
        debitBalance: snapshot.debitBalance,
        creditBalance: snapshot.creditBalance,
        debits: snapshot.debitAmount,
        credits: snapshot.creditAmount,
      },
      confirmedMapping,
      historicalCompanyMappings,
      companyAliases,
      catalogTerms: applicableTerms
        .filter((term) => !(term.scope === "company" && term.type === "alias"))
        .filter((term) => term.type !== "industry_term")
        .map((term) => this.toCatalogTerm(term)),
      catalogAccounts: catalogAccounts.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        parentCode: item.parentId
          ? (parentCodes.get(item.parentId) ?? null)
          : null,
        level: item.level ?? undefined,
      })),
    };
  }

  private toConfirmedMapping(
    mapping: CompanyAccountMappingEntity | null,
    companyAccountId: string,
  ): ConfirmedMappingEvidence | undefined {
    if (
      mapping?.status !== CompanyAccountMappingStatus.CONFIRMED ||
      !mapping.siiAccount
    )
      return undefined;
    return {
      companyAccountId,
      siiAccountId: mapping.siiAccount.id,
      siiCode: mapping.siiAccount.code,
      siiName: mapping.siiAccount.name,
      confirmedAt: mapping.reviewedAt ?? mapping.updatedAt,
      source: mapping.mappingMethod,
    };
  }

  private toCatalogTerm(term: SiiAccountTermEntity): CatalogTermEvidence {
    const type = term.type === "alias" ? "expert_alias" : term.type;
    return {
      normalizedTerm: term.normalizedTerm,
      type,
      scope: term.scope,
      siiAccountId: term.siiAccountId,
      siiCode: term.siiAccount.code,
      siiName: term.siiAccount.name,
      active: term.active,
      companyId: term.companyId ?? undefined,
    };
  }
}

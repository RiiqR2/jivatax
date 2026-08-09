import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { TaxPeriodEntity } from "../accounting/entities/tax-period.entity";
import { CompanyAccountMappingStatus } from "../company-account-plan/enums/company-account-plan.enums";
import { WorkPaperApplicabilityEntity } from "./entities/work-paper-applicability.entity";
import { WorkPaperDefinitionEntity } from "./entities/work-paper-definition.entity";
import { WorkPaperDependencyEntity } from "./entities/work-paper-dependency.entity";
import { WorkPaperEvidenceEntity } from "./entities/work-paper-evidence.entity";
import { WorkPaperExecutionEntity } from "./entities/work-paper-execution.entity";
import { WorkPaperInputEntity } from "./entities/work-paper-input.entity";
import { TaxAdjustmentEntity } from "./entities/tax-adjustment.entity";
import {
  WorkPaperDefinitionStatus,
  WorkPaperExecutionStatus,
} from "./tax-work-paper.enums";

interface ApplicableRawRow {
  definitionId: string;
  code: string;
  name: string;
  definitionVersion: number;
  roleKey: string;
  companyAccountId: string;
  companyAccountCode: string;
  companyAccountName: string;
  siiAccountId: string;
  siiAccountCode: string;
  siiAccountName: string;
  executionId: string | null;
  executionStatus: WorkPaperExecutionStatus | null;
  executionRevision: number | null;
}
export interface ApplicableResult {
  definitionId: string;
  code: string;
  name: string;
  definitionVersion: number;
  reason: "confirmed_sii_account_mapping";
  relatedAccounts: Array<
    Omit<
      ApplicableRawRow,
      | "definitionId"
      | "code"
      | "name"
      | "definitionVersion"
      | "executionId"
      | "executionStatus"
      | "executionRevision"
    >
  >;
  executions: Array<{
    id: string;
    status: WorkPaperExecutionStatus;
    revision: number;
  }>;
}

@Injectable()
export class TaxWorkPapersService {
  constructor(
    @InjectRepository(WorkPaperDefinitionEntity)
    private readonly definitions: Repository<WorkPaperDefinitionEntity>,
    @InjectRepository(WorkPaperExecutionEntity)
    private readonly executions: Repository<WorkPaperExecutionEntity>,
    @InjectRepository(TaxPeriodEntity)
    private readonly periods: Repository<TaxPeriodEntity>,
    private readonly dataSource: DataSource,
  ) {}

  listDefinitions(): Promise<WorkPaperDefinitionEntity[]> {
    return this.definitions.find({
      where: { status: WorkPaperDefinitionStatus.ACTIVE },
      order: { code: "ASC", version: "DESC" },
    });
  }

  async detectApplicable(companyId: string, taxPeriodId: string) {
    await this.requirePeriod(companyId, taxPeriodId);
    const rows = await this.dataSource
      .createQueryBuilder(WorkPaperApplicabilityEntity, "a")
      .innerJoin(
        "a.definition",
        "d",
        "d.status = :active AND d.deleted_at IS NULL",
        { active: WorkPaperDefinitionStatus.ACTIVE },
      )
      .innerJoin("a.siiAccount", "sii")
      .innerJoin(
        "company_account_mappings",
        "m",
        "m.sii_account_id = a.sii_account_id AND m.status = :confirmed AND m.deleted_at IS NULL",
        { confirmed: CompanyAccountMappingStatus.CONFIRMED },
      )
      .innerJoin(
        "company_accounts",
        "ca",
        "ca.id = m.company_account_id AND ca.company_id = :companyId AND ca.deleted_at IS NULL",
        { companyId },
      )
      .innerJoin(
        "tax_period_company_accounts",
        "pca",
        "pca.company_account_id = ca.id AND pca.tax_period_id = :taxPeriodId AND pca.company_id = :companyId AND pca.discarded_at IS NULL",
        { taxPeriodId, companyId },
      )
      .leftJoin(
        WorkPaperExecutionEntity,
        "e",
        "e.definition_id = d.id AND e.company_id = :companyId AND e.tax_period_id = :taxPeriodId AND e.deleted_at IS NULL",
      )
      .select([
        "d.id AS definitionId",
        "d.code AS code",
        "d.name AS name",
        "d.version AS definitionVersion",
        "a.roleKey AS roleKey",
        "ca.id AS companyAccountId",
        "ca.internalCode AS companyAccountCode",
        "ca.name AS companyAccountName",
        "sii.id AS siiAccountId",
        "sii.code AS siiAccountCode",
        "sii.name AS siiAccountName",
        "e.id AS executionId",
        "e.status AS executionStatus",
        "e.revision AS executionRevision",
      ])
      .andWhere("a.is_active = 1 AND a.deleted_at IS NULL")
      .orderBy("d.code", "ASC")
      .addOrderBy("a.role_key", "ASC")
      .getRawMany<ApplicableRawRow>();
    const grouped = new Map<string, ApplicableResult>();
    for (const row of rows) {
      const item = grouped.get(row.definitionId) ?? {
        definitionId: row.definitionId,
        code: row.code,
        name: row.name,
        definitionVersion: row.definitionVersion,
        reason: "confirmed_sii_account_mapping",
        relatedAccounts: [],
        executions: [],
      };
      item.relatedAccounts.push({
        roleKey: row.roleKey,
        companyAccountId: row.companyAccountId,
        companyAccountCode: row.companyAccountCode,
        companyAccountName: row.companyAccountName,
        siiAccountId: row.siiAccountId,
        siiAccountCode: row.siiAccountCode,
        siiAccountName: row.siiAccountName,
      });
      if (
        row.executionId &&
        !item.executions.some((execution) => execution.id === row.executionId)
      )
        item.executions.push({
          id: row.executionId,
          status: row.executionStatus!,
          revision: row.executionRevision!,
        });
      grouped.set(row.definitionId, item);
    }
    return [...grouped.values()];
  }

  async createDraft(
    companyId: string,
    taxPeriodId: string,
    definitionId: string,
    userId: string,
    supersedesExecutionId?: string,
  ) {
    await this.requirePeriod(companyId, taxPeriodId);
    const definition = await this.definitions.findOneBy({
      id: definitionId,
      status: WorkPaperDefinitionStatus.ACTIVE,
    });
    if (!definition)
      throw new NotFoundException(
        "Definición de papel no encontrada o inactiva.",
      );
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WorkPaperExecutionEntity);
      const latest = await repository.findOne({
        where: { companyId, taxPeriodId, definitionId },
        order: { revision: "DESC" },
        lock: { mode: "pessimistic_write" },
      });
      if (latest?.status === WorkPaperExecutionStatus.DRAFT)
        throw new ConflictException(
          "Ya existe una revisión draft para este papel.",
        );
      if (supersedesExecutionId && latest?.id !== supersedesExecutionId)
        throw new BadRequestException(
          "La revisión debe suceder a la última ejecución del mismo papel y tenant.",
        );
      if (
        supersedesExecutionId &&
        latest?.status !== WorkPaperExecutionStatus.FINALIZED
      )
        throw new BadRequestException(
          "Solo una ejecución finalizada puede originar una nueva revisión.",
        );
      if (!supersedesExecutionId && latest)
        throw new ConflictException(
          "Indica explícitamente la ejecución finalizada que será sucedida.",
        );
      return repository.save(
        repository.create({
          companyId,
          taxPeriodId,
          definitionId,
          revision: (latest?.revision ?? 0) + 1,
          status: WorkPaperExecutionStatus.DRAFT,
          supersedesExecutionId: supersedesExecutionId ?? null,
          createdByUserId: userId,
          reviewedByUserId: null,
          finalizedAt: null,
          resultSnapshot: null,
        }),
      );
    });
  }

  async listExecutions(companyId: string, taxPeriodId: string) {
    await this.requirePeriod(companyId, taxPeriodId);
    return this.executions.find({
      where: { companyId, taxPeriodId },
      relations: { definition: true },
      order: { createdAt: "DESC" },
    });
  }
  async getExecution(companyId: string, taxPeriodId: string, id: string) {
    await this.requirePeriod(companyId, taxPeriodId);
    const execution = await this.executions.findOne({
      where: { id, companyId, taxPeriodId },
      relations: { definition: true },
    });
    if (!execution)
      throw new NotFoundException("Ejecución de papel no encontrada.");
    const [inputs, evidence, dependencies, adjustments] = await Promise.all([
      this.dataSource
        .getRepository(WorkPaperInputEntity)
        .findBy({ executionId: id }),
      this.dataSource
        .getRepository(WorkPaperEvidenceEntity)
        .findBy({ executionId: id }),
      this.dataSource.getRepository(WorkPaperDependencyEntity).find({
        where: { executionId: id },
        relations: { dependsOnExecution: true },
      }),
      this.dataSource
        .getRepository(TaxAdjustmentEntity)
        .findBy({ executionId: id, companyId, taxPeriodId }),
    ]);
    return { ...execution, inputs, evidence, dependencies, adjustments };
  }
  private async requirePeriod(companyId: string, taxPeriodId: string) {
    const period = await this.periods.findOneBy({ id: taxPeriodId, companyId });
    if (!period)
      throw new NotFoundException(
        "Período tributario no encontrado para la empresa.",
      );
    return period;
  }
}

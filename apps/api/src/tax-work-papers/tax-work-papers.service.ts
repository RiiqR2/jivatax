import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { TaxPeriodEntity } from "../accounting/entities/tax-period.entity";
import { CompanyAccountMappingStatus } from "../company-account-plan/enums/company-account-plan.enums";
import { SiiAccountEntity } from "../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountPlanVersionStatus } from "../sii-account-plan/enums/sii-account-plan-version-status.enum";
import { TaxPeriodCompanyAccountEntity } from "../accounting/entities/tax-period-company-account.entity";
import { CompanyAccountMappingEntity } from "../company-account-plan/entities/company-account-mapping.entity";
import { CompanyAccountEntity } from "../company-account-plan/entities/company-account.entity";
import { WorkPaperApplicabilityEntity } from "./entities/work-paper-applicability.entity";
import { WorkPaperDefinitionEntity } from "./entities/work-paper-definition.entity";
import { WorkPaperDependencyEntity } from "./entities/work-paper-dependency.entity";
import { WorkPaperEvidenceEntity } from "./entities/work-paper-evidence.entity";
import { WorkPaperExecutionEntity } from "./entities/work-paper-execution.entity";
import { WorkPaperInputEntity } from "./entities/work-paper-input.entity";
import { TaxAdjustmentEntity } from "./entities/tax-adjustment.entity";
import { A17_INPUT, A17V1Calculator } from "./calculators/a17-v1.calculator";
import { FixedDecimal } from "./calculators/fixed-decimal";
import type { CalculationInput } from "./contracts/tax-work-paper-calculator";
import type { A17ManualInputDto } from "./dto/tax-work-paper.dto";
import {
  WorkPaperDefinitionStatus,
  WorkPaperExecutionStatus,
  WorkPaperInputSourceType,
  WorkPaperRecordStatus,
} from "./tax-work-paper.enums";
import {
  groupApplicableRows,
  type ApplicableRawRow,
  type ApplicableResult,
} from "./detect-applicable.mapper";
import { WorkPaperJobEntity } from "./entities/work-paper-job.entity";
import { WorkPaperJobStatus, WorkPaperJobType } from "./tax-work-paper.enums";
import {
  WorkPaperJobService,
  type WorkPaperJobSummary,
} from "./services/work-paper-job.service";
import { buildPeriodSummaryRows } from "./work-paper-period-summary.mapper";

export type { ApplicableResult, WorkPaperJobSummary };

@Injectable()
export class TaxWorkPapersService {
  private readonly logger = new Logger(TaxWorkPapersService.name);

  constructor(
    @InjectRepository(WorkPaperDefinitionEntity)
    private readonly definitions: Repository<WorkPaperDefinitionEntity>,
    @InjectRepository(WorkPaperExecutionEntity)
    private readonly executions: Repository<WorkPaperExecutionEntity>,
    @InjectRepository(TaxPeriodEntity)
    private readonly periods: Repository<TaxPeriodEntity>,
    private readonly dataSource: DataSource,
    private readonly a17Calculator: A17V1Calculator,
    private readonly jobService: WorkPaperJobService,
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
      .innerJoin(
        SiiAccountEntity,
        "sii",
        "sii.code = a.sii_account_code AND sii.deleted_at IS NULL",
      )
      .innerJoin(
        SiiAccountPlanVersionEntity,
        "spv",
        "spv.id = sii.version_id AND spv.status = :catalogActive AND spv.deleted_at IS NULL",
        { catalogActive: SiiAccountPlanVersionStatus.ACTIVE },
      )
      .innerJoin(
        "company_account_mappings",
        "m",
        "m.status = :confirmed AND m.deleted_at IS NULL",
        { confirmed: CompanyAccountMappingStatus.CONFIRMED },
      )
      .innerJoin(
        SiiAccountEntity,
        "mappedSii",
        "mappedSii.id = m.sii_account_id AND mappedSii.code = a.sii_account_code AND mappedSii.deleted_at IS NULL",
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
        "d.metadata AS definitionMetadata",
        "a.roleKey AS roleKey",
        "a.rationale AS rationale",
        "ca.id AS companyAccountId",
        "ca.internalCode AS companyAccountCode",
        "ca.name AS companyAccountName",
        "sii.id AS siiAccountId",
        "sii.code AS siiAccountCode",
        "sii.name AS siiAccountName",
        "e.id AS executionId",
        "e.status AS executionStatus",
        "e.revision AS executionRevision",
        "e.supersedesExecutionId AS supersedesExecutionId",
        "e.finalizedAt AS finalizedAt",
      ])
      .andWhere("a.is_active = 1 AND a.deleted_at IS NULL")
      .orderBy("d.code", "ASC")
      .addOrderBy("a.role_key", "ASC")
      .getRawMany<ApplicableRawRow>();
    return groupApplicableRows(rows);
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
    const recordStatus =
      execution.status === WorkPaperExecutionStatus.DRAFT
        ? WorkPaperRecordStatus.DRAFT
        : WorkPaperRecordStatus.FINALIZED;
    const [inputs, dependencies, adjustments] = await Promise.all([
      this.dataSource
        .getRepository(WorkPaperInputEntity)
        .findBy({ executionId: id, status: recordStatus }),
      this.dataSource.getRepository(WorkPaperDependencyEntity).find({
        where: { executionId: id },
        relations: { dependsOnExecution: true },
      }),
      this.dataSource.getRepository(TaxAdjustmentEntity).findBy({
        executionId: id,
        companyId,
        taxPeriodId,
        status: recordStatus,
      }),
    ]);
    const { activeEvidence: evidence, historicalEvidence } =
      await this.resolveExecutionEvidence(
        this.dataSource.manager,
        id,
        inputs,
        adjustments,
      );
    const [activeJobEntity, latestJobEntity] = await Promise.all([
      this.jobService.findActiveForExecution(id),
      this.jobService.findLatestForExecution(id),
    ]);
    return {
      ...execution,
      inputs,
      evidence,
      historicalEvidence,
      dependencies,
      adjustments,
      activeJob: activeJobEntity
        ? this.jobService.toSummary(activeJobEntity)
        : null,
      latestJob: latestJobEntity
        ? this.jobService.toSummary(latestJobEntity)
        : null,
    };
  }

  async getPeriodSummary(companyId: string, taxPeriodId: string) {
    const applicable = await this.detectApplicable(companyId, taxPeriodId);
    const executionIds = applicable.flatMap((paper) =>
      paper.executions.map((item) => item.id),
    );
    const [executionRows, latestJobs, adjustmentRows] = await Promise.all([
      executionIds.length
        ? this.executions
            .createQueryBuilder("e")
            .select(["e.id", "e.resultSnapshot"])
            .where("e.id IN (:...executionIds)", { executionIds })
            .andWhere("e.company_id = :companyId", { companyId })
            .andWhere("e.tax_period_id = :taxPeriodId", { taxPeriodId })
            .getMany()
        : Promise.resolve([]),
      this.jobService.findLatestJobsForExecutions(executionIds),
      executionIds.length
        ? this.dataSource
            .getRepository(TaxAdjustmentEntity)
            .createQueryBuilder("a")
            .select("a.execution_id", "executionId")
            .addSelect("COUNT(*)", "count")
            .addSelect("SUM(a.amount)", "total")
            .where("a.execution_id IN (:...executionIds)", { executionIds })
            .andWhere("a.company_id = :companyId", { companyId })
            .andWhere("a.tax_period_id = :taxPeriodId", { taxPeriodId })
            .andWhere("a.status = :draft", {
              draft: WorkPaperRecordStatus.DRAFT,
            })
            .groupBy("a.execution_id")
            .getRawMany<{ executionId: string; count: string; total: string }>()
        : Promise.resolve([]),
    ]);
    const executionDetails = new Map(executionRows.map((row) => [row.id, row]));
    const adjustmentStats = new Map(
      adjustmentRows.map((row) => [
        row.executionId,
        {
          executionId: row.executionId,
          count: Number(row.count),
          total: row.total ?? null,
        },
      ]),
    );
    return buildPeriodSummaryRows(
      applicable,
      executionDetails,
      latestJobs,
      adjustmentStats,
    );
  }

  async enqueueCalculation(
    companyId: string,
    taxPeriodId: string,
    executionId: string,
    userId: string,
    manual: A17ManualInputDto[],
  ): Promise<{ id: string; status: WorkPaperJobStatus }> {
    await this.requirePeriod(companyId, taxPeriodId);
    const execution = await this.executions.findOne({
      where: { id: executionId, companyId, taxPeriodId },
      relations: { definition: true },
    });
    if (!execution)
      throw new NotFoundException("Ejecución de papel no encontrada.");
    if (execution.status !== WorkPaperExecutionStatus.DRAFT)
      throw new ConflictException(
        "Una ejecución finalizada no puede recalcularse.",
      );
    if (
      execution.definition.code !== "A.17" ||
      execution.definition.version !== 1
    )
      throw new BadRequestException("La ejecución no corresponde a A.17@1.");

    const job = await this.jobService.enqueueCalculatorRun({
      companyId,
      taxPeriodId,
      executionId,
      userId,
      definitionCode: execution.definition.code,
      definitionVersion: execution.definition.version,
      manualInputs: manual,
    });
    return { id: job.id, status: job.status };
  }

  async getJob(
    companyId: string,
    taxPeriodId: string,
    jobId: string,
  ): Promise<WorkPaperJobSummary> {
    await this.requirePeriod(companyId, taxPeriodId);
    const job = await this.jobService.getJobForTenant(
      companyId,
      taxPeriodId,
      jobId,
    );
    return this.jobService.toSummary(job);
  }

  async processCalculatorRunJob(job: WorkPaperJobEntity): Promise<void> {
    if (job.jobType !== WorkPaperJobType.CALCULATOR_RUN) {
      await this.jobService.markFailed(
        job.id,
        new BadRequestException("Tipo de job no soportado."),
      );
      return;
    }
    const payload = job.payload ?? {};
    const definitionCode =
      typeof payload.definitionCode === "string"
        ? payload.definitionCode
        : null;
    const definitionVersion =
      typeof payload.definitionVersion === "number"
        ? payload.definitionVersion
        : null;
    const manualInputs = Array.isArray(payload.manualInputs)
      ? (payload.manualInputs as A17ManualInputDto[])
      : [];
    if (!definitionCode || definitionVersion == null) {
      await this.jobService.markFailed(
        job.id,
        new BadRequestException("Payload de job inválido."),
      );
      return;
    }
    try {
      await this.dataSource.transaction(async (manager) => {
        if (definitionCode === "A.17" && definitionVersion === 1) {
          await this.executeA17Calculation(
            manager,
            job.companyId,
            job.taxPeriodId,
            job.executionId,
            job.requestedByUserId,
            manualInputs,
          );
          return;
        }
        throw new BadRequestException(
          "No hay calculator registrado para este job.",
        );
      });
      await this.jobService.markCompleted(job.id, {
        executionId: job.executionId,
        definitionCode,
        definitionVersion,
      });
    } catch (error) {
      this.logger.error(
        `Work paper job ${job.id} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.jobService.markFailed(job.id, error);
    }
  }

  async calculateA17(
    companyId: string,
    taxPeriodId: string,
    executionId: string,
    userId: string,
    manual: A17ManualInputDto[],
  ) {
    return this.enqueueCalculation(
      companyId,
      taxPeriodId,
      executionId,
      userId,
      manual,
    );
  }

  private async executeA17Calculation(
    manager: EntityManager,
    companyId: string,
    taxPeriodId: string,
    executionId: string,
    userId: string,
    manual: A17ManualInputDto[],
  ) {
    const executionRepository = manager.getRepository(WorkPaperExecutionEntity);
    const execution = await executionRepository.findOne({
      where: { id: executionId, companyId, taxPeriodId },
      relations: { definition: true },
      lock: { mode: "pessimistic_write" },
    });
    if (!execution)
      throw new NotFoundException("Ejecución de papel no encontrada.");
    if (execution.status !== WorkPaperExecutionStatus.DRAFT)
      throw new ConflictException(
        "Una ejecución finalizada no puede recalcularse.",
      );
    if (
      execution.definition.code !== "A.17" ||
      execution.definition.version !== 1
    )
      throw new BadRequestException("La ejecución no corresponde a A.17@1.");

    const automatic = await this.resolveA17ClosingInputs(
      manager,
      companyId,
      taxPeriodId,
      execution.definitionId,
    );
    const manualInputs: CalculationInput[] = manual.map((item) => ({
      inputKey: item.inputKey,
      sourceType: WorkPaperInputSourceType.MANUAL,
      sourceEntityType: "user",
      sourceEntityId: userId,
      valueSnapshot: item.value,
      payloadSnapshot: {
        description: item.description ?? null,
        capturedAt: new Date().toISOString(),
      },
      evidence: [
        {
          type: "manual_declaration",
          sourceEntityType: "user",
          sourceEntityId: userId,
          locator: { inputKey: item.inputKey },
        },
      ],
    }));
    const merged = new Map(automatic.map((input) => [input.inputKey, input]));
    for (const input of manualInputs) merged.set(input.inputKey, input);
    const inputs = [...merged.values()];
    const result = await this.a17Calculator.calculate({
      companyId,
      taxPeriodId,
      executionId,
      definitionCode: "A.17",
      definitionVersion: 1,
      inputs,
    });

    const inputRepository = manager.getRepository(WorkPaperInputEntity);
    const adjustmentRepository = manager.getRepository(TaxAdjustmentEntity);
    await inputRepository.update(
      { executionId, status: WorkPaperRecordStatus.DRAFT },
      { status: WorkPaperRecordStatus.VOID },
    );
    await adjustmentRepository.update(
      { executionId, status: WorkPaperRecordStatus.DRAFT },
      { status: WorkPaperRecordStatus.VOID },
    );
    const previousInputs = await inputRepository.find({
      where: { executionId },
      order: { revision: "DESC" },
    });
    const nextInputRevision =
      Math.max(0, ...previousInputs.map((item) => item.revision)) + 1;
    const savedInputs = await inputRepository.save(
      inputs.map((input) =>
        inputRepository.create({
          executionId,
          inputKey: input.inputKey,
          sourceType: input.sourceType,
          sourceEntityType: input.sourceEntityType ?? null,
          sourceEntityId: input.sourceEntityId ?? null,
          valueSnapshot: input.valueSnapshot ?? null,
          payloadSnapshot: input.payloadSnapshot ?? null,
          revision: nextInputRevision,
          status: WorkPaperRecordStatus.DRAFT,
        }),
      ),
    );
    const previousAdjustments = await adjustmentRepository.find({
      where: { executionId },
      order: { revision: "DESC" },
    });
    const nextAdjustmentRevision =
      Math.max(0, ...previousAdjustments.map((item) => item.revision)) + 1;
    const savedAdjustments = await adjustmentRepository.save(
      result.taxAdjustments.map((adjustment) =>
        adjustmentRepository.create({
          companyId,
          taxPeriodId,
          executionId,
          type: adjustment.type,
          amount: adjustment.amount,
          description: adjustment.description,
          differenceNature: adjustment.differenceNature ?? null,
          ruleKey: adjustment.ruleKey,
          revision: nextAdjustmentRevision,
          status: WorkPaperRecordStatus.DRAFT,
        }),
      ),
    );
    const evidenceRepository = manager.getRepository(WorkPaperEvidenceEntity);
    const evidenceRows = savedInputs.flatMap((saved, index) =>
      (inputs[index].evidence ?? []).map((item) =>
        evidenceRepository.create({
          executionId,
          inputId: saved.id,
          adjustmentId: null,
          evidenceType: item.type,
          sourceEntityType: item.sourceEntityType,
          sourceEntityId: item.sourceEntityId,
          locator: item.locator ?? null,
          description: null,
        }),
      ),
    );
    for (let index = 0; index < savedAdjustments.length; index++)
      for (const item of result.taxAdjustments[index].evidence ?? [])
        evidenceRows.push(
          evidenceRepository.create({
            executionId,
            inputId: null,
            adjustmentId: savedAdjustments[index].id,
            evidenceType: item.type,
            sourceEntityType: item.sourceEntityType,
            sourceEntityId: item.sourceEntityId,
            locator: item.locator ?? null,
            description: null,
          }),
        );
    await evidenceRepository.save(evidenceRows);
    execution.resultSnapshot = result as unknown as Record<string, unknown>;
    await executionRepository.save(execution);
  }

  private async resolveA17ClosingInputs(
    manager: EntityManager,
    companyId: string,
    taxPeriodId: string,
    definitionId: string,
  ): Promise<CalculationInput[]> {
    const rows = await manager
      .createQueryBuilder(WorkPaperApplicabilityEntity, "a")
      .innerJoin(
        SiiAccountEntity,
        "sii",
        "sii.code = a.sii_account_code AND sii.deleted_at IS NULL",
      )
      .innerJoin(
        SiiAccountPlanVersionEntity,
        "spv",
        "spv.id = sii.version_id AND spv.status = :catalogActive AND spv.deleted_at IS NULL",
        { catalogActive: SiiAccountPlanVersionStatus.ACTIVE },
      )
      .innerJoin(
        CompanyAccountMappingEntity,
        "m",
        "m.status = :confirmed AND m.deleted_at IS NULL",
        { confirmed: CompanyAccountMappingStatus.CONFIRMED },
      )
      .innerJoin(
        SiiAccountEntity,
        "mappedSii",
        "mappedSii.id = m.sii_account_id AND mappedSii.code = a.sii_account_code AND mappedSii.deleted_at IS NULL",
      )
      .innerJoin(
        CompanyAccountEntity,
        "ca",
        "ca.id = m.company_account_id AND ca.company_id = :companyId AND ca.deleted_at IS NULL",
        { companyId },
      )
      .innerJoin(
        TaxPeriodCompanyAccountEntity,
        "pca",
        "pca.company_account_id = ca.id AND pca.company_id = :companyId AND pca.tax_period_id = :taxPeriodId AND pca.discarded_at IS NULL",
        { companyId, taxPeriodId },
      )
      .select("a.role_key", "roleKey")
      .addSelect(
        "CASE WHEN a.role_key = 'LEASE_LIABILITY' THEN pca.liability_amount ELSE pca.asset_amount END",
        "amount",
      )
      .addSelect("pca.id", "sourceEntityId")
      .addSelect("pca.source_document_id", "documentId")
      .where("a.definition_id = :definitionId", { definitionId })
      .andWhere("a.is_active = :isActive AND a.deleted_at IS NULL", {
        isActive: true,
      })
      .getRawMany<{
        roleKey: string;
        amount: string;
        sourceEntityId: string;
        documentId: string;
      }>();
    const grouped = new Map<string, typeof rows>();
    for (const row of rows)
      grouped.set(row.roleKey, [...(grouped.get(row.roleKey) ?? []), row]);
    const output: CalculationInput[] = [];
    for (const [role, key] of [
      ["LEASE_LIABILITY", A17_INPUT.LIABILITY_CLOSING],
      ["DEFERRED_LEASE_INTEREST", A17_INPUT.DEFERRED_CLOSING],
    ] as const) {
      const matches = grouped.get(role) ?? [];
      if (!matches.length) continue;
      const total = matches
        .reduce(
          (sum, row) => sum.add(FixedDecimal.parse(row.amount)),
          FixedDecimal.zero(),
        )
        .toString();
      output.push({
        inputKey: key,
        sourceType: WorkPaperInputSourceType.BALANCE,
        sourceEntityType: "tax_period_company_account",
        sourceEntityId: matches[0].sourceEntityId,
        valueSnapshot: total,
        payloadSnapshot: {
          role,
          accountIds: matches.map((row) => row.sourceEntityId),
          documentIds: [...new Set(matches.map((row) => row.documentId))],
        },
        evidence: matches.map((row) => ({
          type: "confirmed_mapping_closing_balance",
          sourceEntityType: "tax_period_company_account",
          sourceEntityId: row.sourceEntityId,
          locator: { role, documentId: row.documentId },
        })),
      });
    }
    return output;
  }

  private async resolveExecutionEvidence(
    manager: EntityManager,
    executionId: string,
    inputs: WorkPaperInputEntity[],
    adjustments: TaxAdjustmentEntity[],
  ) {
    const allEvidence = await manager
      .getRepository(WorkPaperEvidenceEntity)
      .findBy({ executionId });
    const activeInputIds = new Set(inputs.map((input) => input.id));
    const activeAdjustmentIds = new Set(
      adjustments.map((adjustment) => adjustment.id),
    );
    const isActive = (item: WorkPaperEvidenceEntity) =>
      (item.inputId !== null && activeInputIds.has(item.inputId)) ||
      (item.adjustmentId !== null &&
        activeAdjustmentIds.has(item.adjustmentId));
    return {
      activeEvidence: allEvidence.filter(isActive),
      historicalEvidence: allEvidence.filter((item) => !isActive(item)),
    };
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

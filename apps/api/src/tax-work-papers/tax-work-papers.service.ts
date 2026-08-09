import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, Repository } from "typeorm";
import { TaxPeriodEntity } from "../accounting/entities/tax-period.entity";
import { CompanyAccountMappingStatus } from "../company-account-plan/enums/company-account-plan.enums";
import { WorkPaperApplicabilityEntity } from "./entities/work-paper-applicability.entity";
import { WorkPaperDefinitionEntity } from "./entities/work-paper-definition.entity";
import { WorkPaperDependencyEntity } from "./entities/work-paper-dependency.entity";
import { WorkPaperEvidenceEntity } from "./entities/work-paper-evidence.entity";
import { WorkPaperExecutionEntity } from "./entities/work-paper-execution.entity";
import { WorkPaperInputEntity } from "./entities/work-paper-input.entity";
import { TaxAdjustmentEntity } from "./entities/tax-adjustment.entity";
import { A17_INPUT, A17V1Calculator } from "./calculators/a17-v1.calculator";
import type { CalculationInput } from "./contracts/tax-work-paper-calculator";
import type { A17ManualInputDto } from "./dto/tax-work-paper.dto";
import {
  WorkPaperDefinitionStatus,
  WorkPaperExecutionStatus,
  WorkPaperInputSourceType,
  WorkPaperRecordStatus,
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
    private readonly a17Calculator: A17V1Calculator,
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
    const recordStatus =
      execution.status === WorkPaperExecutionStatus.DRAFT
        ? WorkPaperRecordStatus.DRAFT
        : WorkPaperRecordStatus.FINALIZED;
    const [inputs, evidence, dependencies, adjustments] = await Promise.all([
      this.dataSource
        .getRepository(WorkPaperInputEntity)
        .findBy({ executionId: id, status: recordStatus }),
      this.dataSource
        .getRepository(WorkPaperEvidenceEntity)
        .findBy({ executionId: id }),
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
    return { ...execution, inputs, evidence, dependencies, adjustments };
  }

  async calculateA17(
    companyId: string,
    taxPeriodId: string,
    executionId: string,
    userId: string,
    manual: A17ManualInputDto[],
  ) {
    await this.requirePeriod(companyId, taxPeriodId);
    return this.dataSource.transaction(async (manager) => {
      const executionRepository = manager.getRepository(
        WorkPaperExecutionEntity,
      );
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
      return this.getExecutionSnapshot(
        manager,
        execution,
        savedInputs,
        savedAdjustments,
      );
    });
  }

  private async resolveA17ClosingInputs(
    manager: EntityManager,
    companyId: string,
    taxPeriodId: string,
    definitionId: string,
  ): Promise<CalculationInput[]> {
    const rows = await manager.query<
      Array<{
        roleKey: string;
        amount: string;
        sourceEntityId: string;
        documentId: string;
      }>
    >(
      `SELECT a.role_key roleKey,
              CASE WHEN a.role_key = 'LEASE_LIABILITY' THEN pca.liability_amount ELSE pca.asset_amount END amount,
              pca.id sourceEntityId, pca.source_document_id documentId
         FROM tax_work_paper_applicabilities a
         JOIN company_account_mappings m ON m.sii_account_id=a.sii_account_id AND m.status='confirmed' AND m.deleted_at IS NULL
         JOIN company_accounts ca ON ca.id=m.company_account_id AND ca.company_id=? AND ca.deleted_at IS NULL
         JOIN tax_period_company_accounts pca ON pca.company_account_id=ca.id AND pca.company_id=? AND pca.tax_period_id=? AND pca.discarded_at IS NULL
        WHERE a.definition_id=? AND a.is_active=1 AND a.deleted_at IS NULL`,
      [companyId, companyId, taxPeriodId, definitionId],
    );
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
      // SQL decimal addition preserves precision and avoids JS numeric coercion.
      const [{ total }] = await manager.query<Array<{ total: string }>>(
        `SELECT CAST(SUM(x.amount) AS DECIMAL(24,4)) total FROM (${matches.map(() => "SELECT CAST(? AS DECIMAL(24,4)) amount").join(" UNION ALL ")}) x`,
        matches.map((row) => row.amount),
      );
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

  private getExecutionSnapshot(
    manager: EntityManager,
    execution: WorkPaperExecutionEntity,
    inputs: WorkPaperInputEntity[],
    adjustments: TaxAdjustmentEntity[],
  ) {
    return manager
      .getRepository(WorkPaperEvidenceEntity)
      .findBy({ executionId: execution.id })
      .then((evidence) => ({
        ...execution,
        inputs,
        evidence,
        dependencies: [],
        adjustments,
      }));
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

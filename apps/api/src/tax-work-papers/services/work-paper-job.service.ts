import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, In, Repository } from "typeorm";
import { WorkPaperExecutionEntity } from "../entities/work-paper-execution.entity";
import { WorkPaperJobEntity } from "../entities/work-paper-job.entity";
import { WorkPaperJobStatus, WorkPaperJobType } from "../tax-work-paper.enums";
import type { A17ManualInputDto } from "../dto/tax-work-paper.dto";

export interface WorkPaperJobSummary {
  id: string;
  status: WorkPaperJobStatus;
  jobType: WorkPaperJobType;
  attempt: number;
  progress: number | null;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  errorDetail: Record<string, unknown> | null;
  resultReference: Record<string, unknown> | null;
  createdAt: string;
}

export interface EnqueueCalculatorRunInput {
  companyId: string;
  taxPeriodId: string;
  executionId: string;
  userId: string;
  definitionCode: string;
  definitionVersion: number;
  manualInputs: A17ManualInputDto[];
}

@Injectable()
export class WorkPaperJobService {
  constructor(
    @InjectRepository(WorkPaperJobEntity)
    private readonly jobs: Repository<WorkPaperJobEntity>,
    @InjectRepository(WorkPaperExecutionEntity)
    private readonly executions: Repository<WorkPaperExecutionEntity>,
    private readonly dataSource: DataSource,
  ) {}

  toSummary(job: WorkPaperJobEntity): WorkPaperJobSummary {
    return {
      id: job.id,
      status: job.status,
      jobType: job.jobType,
      attempt: job.attempt,
      progress: job.progress,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      failedAt: job.failedAt?.toISOString() ?? null,
      errorDetail: job.errorDetail,
      resultReference: job.resultReference,
      createdAt: job.createdAt.toISOString(),
    };
  }

  async enqueueCalculatorRun(
    input: EnqueueCalculatorRunInput,
  ): Promise<WorkPaperJobEntity> {
    const execution = await this.executions.findOne({
      where: {
        id: input.executionId,
        companyId: input.companyId,
        taxPeriodId: input.taxPeriodId,
      },
      relations: { definition: true },
    });
    if (!execution)
      throw new NotFoundException("Ejecución de papel no encontrada.");
    if (execution.definition.code !== input.definitionCode)
      throw new BadRequestException(
        "La ejecución no corresponde al papel solicitado.",
      );
    if (execution.definition.version !== input.definitionVersion)
      throw new BadRequestException(
        "La versión de definición no coincide con la ejecución.",
      );

    const active = await this.jobs.findOne({
      where: {
        executionId: input.executionId,
        jobType: WorkPaperJobType.CALCULATOR_RUN,
        status: In([WorkPaperJobStatus.PENDING, WorkPaperJobStatus.RUNNING]),
      },
      order: { createdAt: "DESC" },
    });
    if (active) return active;

    const previousAttempts = await this.jobs.count({
      where: {
        executionId: input.executionId,
        jobType: WorkPaperJobType.CALCULATOR_RUN,
      },
    });

    return this.jobs.save(
      this.jobs.create({
        companyId: input.companyId,
        taxPeriodId: input.taxPeriodId,
        executionId: input.executionId,
        jobType: WorkPaperJobType.CALCULATOR_RUN,
        status: WorkPaperJobStatus.PENDING,
        attempt: previousAttempts + 1,
        progress: null,
        requestedByUserId: input.userId,
        startedAt: null,
        completedAt: null,
        failedAt: null,
        payload: {
          definitionCode: input.definitionCode,
          definitionVersion: input.definitionVersion,
          manualInputs: input.manualInputs,
        },
        resultReference: null,
        errorDetail: null,
      }),
    );
  }

  async getJobForTenant(
    companyId: string,
    taxPeriodId: string,
    jobId: string,
  ): Promise<WorkPaperJobEntity> {
    const job = await this.jobs.findOneBy({
      id: jobId,
      companyId,
      taxPeriodId,
    });
    if (!job) throw new NotFoundException("Job de papel no encontrado.");
    return job;
  }

  async findLatestForExecution(
    executionId: string,
  ): Promise<WorkPaperJobEntity | null> {
    return this.jobs.findOne({
      where: { executionId },
      order: { createdAt: "DESC" },
    });
  }

  async findActiveForExecution(
    executionId: string,
  ): Promise<WorkPaperJobEntity | null> {
    return this.jobs.findOne({
      where: {
        executionId,
        status: In([WorkPaperJobStatus.PENDING, WorkPaperJobStatus.RUNNING]),
      },
      order: { createdAt: "DESC" },
    });
  }

  async findLatestJobsForExecutions(
    executionIds: string[],
  ): Promise<Map<string, WorkPaperJobEntity>> {
    if (executionIds.length === 0) return new Map();
    const rows = await this.jobs
      .createQueryBuilder("j")
      .where("j.execution_id IN (:...executionIds)", { executionIds })
      .orderBy("j.created_at", "DESC")
      .getMany();
    const map = new Map<string, WorkPaperJobEntity>();
    for (const row of rows) {
      if (!map.has(row.executionId)) map.set(row.executionId, row);
    }
    return map;
  }

  async claimNextPending(): Promise<WorkPaperJobEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WorkPaperJobEntity);
      const job = await repository
        .createQueryBuilder("j")
        .setLock("pessimistic_write")
        .where("j.status = :pending", {
          pending: WorkPaperJobStatus.PENDING,
        })
        .orderBy("j.created_at", "ASC")
        .getOne();
      if (!job) return null;
      job.status = WorkPaperJobStatus.RUNNING;
      job.startedAt = new Date();
      return repository.save(job);
    });
  }

  async markCompleted(
    jobId: string,
    resultReference: Record<string, unknown>,
  ): Promise<void> {
    const job = await this.jobs.findOneBy({ id: jobId });
    if (!job) return;
    job.status = WorkPaperJobStatus.COMPLETED;
    job.completedAt = new Date();
    job.resultReference = resultReference;
    job.errorDetail = null;
    await this.jobs.save(job);
  }

  async markFailed(jobId: string, error: unknown): Promise<void> {
    const message =
      error instanceof Error ? error.message : "Error desconocido en el job.";
    const detail: Record<string, unknown> = {
      message,
      name: error instanceof Error ? error.name : "Error",
    };
    if (error instanceof Error && error.stack) detail.stack = error.stack;
    const job = await this.jobs.findOneBy({ id: jobId });
    if (!job) return;
    job.status = WorkPaperJobStatus.FAILED;
    job.failedAt = new Date();
    job.errorDetail = detail;
    await this.jobs.save(job);
  }
}

import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { UserEntity } from "../../users/entities/user.entity";
import { WorkPaperJobStatus, WorkPaperJobType } from "../tax-work-paper.enums";
import { WorkPaperExecutionEntity } from "./work-paper-execution.entity";

@Entity({ name: "tax_work_paper_jobs" })
@Index("idx_work_paper_job_tenant_period", ["companyId", "taxPeriodId"])
@Index("idx_work_paper_job_execution", ["executionId"])
@Index("idx_work_paper_job_status_created", ["status", "createdAt"])
export class WorkPaperJobEntity extends BaseEntity {
  @Column({ name: "company_id", type: "char", length: 36 })
  companyId!: string;

  @Column({ name: "tax_period_id", type: "char", length: 36 })
  taxPeriodId!: string;

  @Column({ name: "execution_id", type: "char", length: 36 })
  executionId!: string;

  @Column({ name: "job_type", type: "enum", enum: WorkPaperJobType })
  jobType!: WorkPaperJobType;

  @Column({ type: "enum", enum: WorkPaperJobStatus })
  status!: WorkPaperJobStatus;

  @Column({ type: "int", unsigned: true, default: 1 })
  attempt!: number;

  @Column({ type: "tinyint", unsigned: true, nullable: true })
  progress!: number | null;

  @Column({ name: "requested_by_user_id", type: "char", length: 36 })
  requestedByUserId!: string;

  @Column({
    name: "started_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  startedAt!: Date | null;

  @Column({
    name: "completed_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  completedAt!: Date | null;

  @Column({ name: "failed_at", type: "datetime", precision: 6, nullable: true })
  failedAt!: Date | null;

  @Column({ type: "json", nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ name: "result_reference", type: "json", nullable: true })
  resultReference!: Record<string, unknown> | null;

  @Column({ name: "error_detail", type: "json", nullable: true })
  errorDetail!: Record<string, unknown> | null;

  @ManyToOne(() => WorkPaperExecutionEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "execution_id" })
  execution!: WorkPaperExecutionEntity;

  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "requested_by_user_id" })
  requestedBy!: UserEntity;
}

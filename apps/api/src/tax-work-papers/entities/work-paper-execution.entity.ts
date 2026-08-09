import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { TaxPeriodEntity } from "../../accounting/entities/tax-period.entity";
import { UserEntity } from "../../users/entities/user.entity";
import { WorkPaperExecutionStatus } from "../tax-work-paper.enums";
import { WorkPaperDefinitionEntity } from "./work-paper-definition.entity";

@Entity({ name: "tax_work_paper_executions" })
@Index(
  "uq_work_paper_execution_revision",
  ["companyId", "taxPeriodId", "definitionId", "revision"],
  { unique: true },
)
export class WorkPaperExecutionEntity extends BaseEntity {
  @Column({ name: "company_id", type: "char", length: 36 }) companyId!: string;
  @Column({ name: "tax_period_id", type: "char", length: 36 })
  taxPeriodId!: string;
  @Column({ name: "definition_id", type: "char", length: 36 })
  definitionId!: string;
  @Column({ type: "int", unsigned: true }) revision!: number;
  @Column({
    type: "enum",
    enum: WorkPaperExecutionStatus,
    default: WorkPaperExecutionStatus.DRAFT,
  })
  status!: WorkPaperExecutionStatus;
  @Column({
    name: "supersedes_execution_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  supersedesExecutionId!: string | null;
  @Column({ name: "created_by_user_id", type: "char", length: 36 })
  createdByUserId!: string;
  @Column({
    name: "reviewed_by_user_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  reviewedByUserId!: string | null;
  @Column({
    name: "finalized_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  finalizedAt!: Date | null;
  @Column({ name: "result_snapshot", type: "json", nullable: true })
  resultSnapshot!: Record<string, unknown> | null;
  @ManyToOne(() => CompanyEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "company_id" })
  company!: CompanyEntity;
  @ManyToOne(() => TaxPeriodEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "tax_period_id" })
  taxPeriod!: TaxPeriodEntity;
  @ManyToOne(() => WorkPaperDefinitionEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "definition_id" })
  definition!: WorkPaperDefinitionEntity;
  @ManyToOne(() => WorkPaperExecutionEntity, {
    nullable: true,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "supersedes_execution_id" })
  supersedesExecution!: WorkPaperExecutionEntity | null;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "created_by_user_id" })
  createdByUser!: UserEntity;
}

import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { WorkPaperExecutionEntity } from "./work-paper-execution.entity";
@Entity({ name: "tax_work_paper_evidence" })
@Index("idx_work_paper_evidence_execution", ["executionId"])
export class WorkPaperEvidenceEntity extends BaseEntity {
  @Column({ name: "execution_id", type: "char", length: 36 })
  executionId!: string;
  @Column({ name: "input_id", type: "char", length: 36, nullable: true })
  inputId!: string | null;
  @Column({ name: "adjustment_id", type: "char", length: 36, nullable: true })
  adjustmentId!: string | null;
  @Column({ name: "evidence_type", type: "varchar", length: 80 })
  evidenceType!: string;
  @Column({ name: "source_entity_type", type: "varchar", length: 80 })
  sourceEntityType!: string;
  @Column({ name: "source_entity_id", type: "char", length: 36 })
  sourceEntityId!: string;
  @Column({ type: "json", nullable: true }) locator!: Record<
    string,
    unknown
  > | null;
  @Column({ type: "text", nullable: true }) description!: string | null;
  @ManyToOne(() => WorkPaperExecutionEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "execution_id" })
  execution!: WorkPaperExecutionEntity;
}

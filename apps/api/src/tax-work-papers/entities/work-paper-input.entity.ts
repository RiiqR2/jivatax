import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import {
  WorkPaperInputSourceType,
  WorkPaperRecordStatus,
} from "../tax-work-paper.enums";
import { WorkPaperExecutionEntity } from "./work-paper-execution.entity";
@Entity({ name: "tax_work_paper_inputs" })
@Index(
  "uq_work_paper_input_revision",
  ["executionId", "inputKey", "revision"],
  { unique: true },
)
export class WorkPaperInputEntity extends BaseEntity {
  @Column({ name: "execution_id", type: "char", length: 36 })
  executionId!: string;
  @Column({ name: "input_key", type: "varchar", length: 100 })
  inputKey!: string;
  @Column({ name: "source_type", type: "enum", enum: WorkPaperInputSourceType })
  sourceType!: WorkPaperInputSourceType;
  @Column({
    name: "source_entity_type",
    type: "varchar",
    length: 80,
    nullable: true,
  })
  sourceEntityType!: string | null;
  @Column({
    name: "source_entity_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  sourceEntityId!: string | null;
  @Column({
    name: "value_snapshot",
    type: "decimal",
    precision: 24,
    scale: 4,
    nullable: true,
  })
  valueSnapshot!: string | null;
  @Column({ name: "payload_snapshot", type: "json", nullable: true })
  payloadSnapshot!: Record<string, unknown> | null;
  @Column({ type: "int", unsigned: true }) revision!: number;
  @Column({
    type: "enum",
    enum: WorkPaperRecordStatus,
    default: WorkPaperRecordStatus.DRAFT,
  })
  status!: WorkPaperRecordStatus;
  @ManyToOne(() => WorkPaperExecutionEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "execution_id" })
  execution!: WorkPaperExecutionEntity;
}

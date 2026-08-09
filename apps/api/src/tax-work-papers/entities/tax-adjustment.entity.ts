import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import {
  WorkPaperRecordStatus,
  TaxAdjustmentType,
  TaxDifferenceNature,
} from "../tax-work-paper.enums";
import { WorkPaperExecutionEntity } from "./work-paper-execution.entity";
@Entity({ name: "tax_adjustments" })
@Index("idx_tax_adjustments_tenant_period", [
  "companyId",
  "taxPeriodId",
  "type",
])
export class TaxAdjustmentEntity extends BaseEntity {
  @Column({ name: "company_id", type: "char", length: 36 }) companyId!: string;
  @Column({ name: "tax_period_id", type: "char", length: 36 })
  taxPeriodId!: string;
  @Column({ name: "execution_id", type: "char", length: 36 })
  executionId!: string;
  @Column({ type: "enum", enum: TaxAdjustmentType }) type!: TaxAdjustmentType;
  @Column({ type: "decimal", precision: 24, scale: 4 }) amount!: string;
  @Column({ type: "text" }) description!: string;
  @Column({
    name: "difference_nature",
    type: "enum",
    enum: TaxDifferenceNature,
    nullable: true,
  })
  differenceNature!: TaxDifferenceNature | null;
  @Column({ name: "rule_key", type: "varchar", length: 150 }) ruleKey!: string;
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

import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { WorkPaperExecutionEntity } from "./work-paper-execution.entity";
@Entity({ name: "tax_work_paper_dependencies" })
@Index("uq_work_paper_dependency", ["executionId", "dependsOnExecutionId"], {
  unique: true,
})
export class WorkPaperDependencyEntity extends BaseEntity {
  @Column({ name: "execution_id", type: "char", length: 36 })
  executionId!: string;
  @Column({ name: "depends_on_execution_id", type: "char", length: 36 })
  dependsOnExecutionId!: string;
  @Column({ name: "dependency_key", type: "varchar", length: 100 })
  dependencyKey!: string;
  @Column({ type: "text", nullable: true }) description!: string | null;
  @ManyToOne(() => WorkPaperExecutionEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "execution_id" })
  execution!: WorkPaperExecutionEntity;
  @ManyToOne(() => WorkPaperExecutionEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "depends_on_execution_id" })
  dependsOnExecution!: WorkPaperExecutionEntity;
}

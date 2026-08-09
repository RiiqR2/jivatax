import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { WorkPaperDefinitionStatus } from "../tax-work-paper.enums";

@Entity({ name: "tax_work_paper_definitions" })
@Index("uq_tax_work_paper_definition_version", ["code", "version"], {
  unique: true,
})
export class WorkPaperDefinitionEntity extends BaseEntity {
  @Column({ type: "varchar", length: 20 }) code!: string;
  @Column({ type: "varchar", length: 255 }) name!: string;
  @Column({ type: "text", nullable: true }) description!: string | null;
  @Column({ type: "int", unsigned: true }) version!: number;
  @Column({ name: "effective_from", type: "date", nullable: true })
  effectiveFrom!: string | null;
  @Column({ name: "effective_to", type: "date", nullable: true }) effectiveTo!:
    string | null;
  @Column({ type: "enum", enum: WorkPaperDefinitionStatus })
  status!: WorkPaperDefinitionStatus;
  @Column({ type: "json", nullable: true }) metadata!: Record<
    string,
    unknown
  > | null;
  @Column({ name: "required_inputs", type: "json", nullable: true })
  requiredInputs!: unknown[] | null;
  @Column({ name: "possible_outputs", type: "json", nullable: true })
  possibleOutputs!: unknown[] | null;
}

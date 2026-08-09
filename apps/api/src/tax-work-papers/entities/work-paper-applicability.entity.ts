import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { WorkPaperDefinitionEntity } from "./work-paper-definition.entity";

@Entity({ name: "tax_work_paper_applicabilities" })
@Index(
  "uq_work_paper_applicability_role",
  ["definitionId", "siiAccountCode", "roleKey"],
  { unique: true },
)
export class WorkPaperApplicabilityEntity extends BaseEntity {
  @Column({ name: "definition_id", type: "char", length: 36 })
  definitionId!: string;
  @Column({ name: "sii_account_code", type: "varchar", length: 100 })
  siiAccountCode!: string;
  /** Audit-only reference migrated from the former UUID-based identity. */
  @Column({
    name: "legacy_sii_account_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  legacySiiAccountId!: string | null;
  @Column({ name: "role_key", type: "varchar", length: 100 }) roleKey!: string;
  @Column({ type: "text", nullable: true }) rationale!: string | null;
  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;
  @ManyToOne(() => WorkPaperDefinitionEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "definition_id" })
  definition!: WorkPaperDefinitionEntity;
}

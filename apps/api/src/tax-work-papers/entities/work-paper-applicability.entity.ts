import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { WorkPaperDefinitionEntity } from "./work-paper-definition.entity";

@Entity({ name: "tax_work_paper_applicabilities" })
@Index(
  "uq_work_paper_applicability_role",
  ["definitionId", "siiAccountId", "roleKey"],
  { unique: true },
)
export class WorkPaperApplicabilityEntity extends BaseEntity {
  @Column({ name: "definition_id", type: "char", length: 36 })
  definitionId!: string;
  @Column({ name: "sii_account_id", type: "char", length: 36 })
  siiAccountId!: string;
  @Column({ name: "role_key", type: "varchar", length: 100 }) roleKey!: string;
  @Column({ type: "text", nullable: true }) rationale!: string | null;
  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;
  @ManyToOne(() => WorkPaperDefinitionEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "definition_id" })
  definition!: WorkPaperDefinitionEntity;
  @ManyToOne(() => SiiAccountEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "sii_account_id" })
  siiAccount!: SiiAccountEntity;
}

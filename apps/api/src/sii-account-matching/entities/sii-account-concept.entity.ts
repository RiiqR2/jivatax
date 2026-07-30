import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";

export const SII_ACCOUNT_CONCEPT_TYPES = [
  "economic_concept",
  "accounting_family",
  "statement_section",
  "balance_nature",
  "temporal_classification",
  "contra_account_indicator",
  "tax_concept",
  "industry_concept",
] as const;

export type SiiAccountConceptType = (typeof SII_ACCOUNT_CONCEPT_TYPES)[number];

@Entity({ name: "sii_account_concepts" })
@Index(
  "uq_sii_account_concepts_identity",
  ["siiAccountId", "normalizedConcept", "conceptType", "source"],
  { unique: true },
)
@Index("idx_sii_account_concepts_account", ["siiAccountId"])
@Index("idx_sii_account_concepts_normalized", ["normalizedConcept"])
@Index("idx_sii_account_concepts_type", ["conceptType"])
@Index("idx_sii_account_concepts_active", ["active"])
export class SiiAccountConceptEntity extends BaseEntity {
  @Column({ name: "sii_account_id", type: "char", length: 36 })
  siiAccountId!: string;

  @Column({ type: "varchar", length: 255 })
  concept!: string;

  @Column({ name: "normalized_concept", type: "varchar", length: 255 })
  normalizedConcept!: string;

  @Column({
    name: "concept_type",
    type: "enum",
    enum: SII_ACCOUNT_CONCEPT_TYPES,
  })
  conceptType!: SiiAccountConceptType;

  @Column({ type: "decimal", precision: 7, scale: 2 })
  weight!: number;

  @Column({ type: "varchar", length: 100 })
  source!: string;

  @Column({ type: "boolean", default: true })
  active!: boolean;

  @ManyToOne(() => SiiAccountEntity, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "sii_account_id",
    foreignKeyConstraintName: "fk_sii_account_concepts_account",
  })
  siiAccount!: SiiAccountEntity;
}

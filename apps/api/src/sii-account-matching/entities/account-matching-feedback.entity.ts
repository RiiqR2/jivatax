import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

@Entity({ name: "account_matching_feedback" })
@Index("idx_matching_feedback_alias", ["normalizedName", "accepted"])
export class AccountMatchingFeedbackEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "company_id", type: "char", length: 36 }) companyId!: string;
  @Column({ name: "tax_period_id", type: "char", length: 36, nullable: true })
  taxPeriodId!: string | null;
  @Column({ name: "normalized_name", type: "varchar", length: 500 })
  normalizedName!: string;
  @Column({ name: "sii_account_id", type: "char", length: 36 })
  siiAccountId!: string;
  @Column({
    name: "original_score",
    type: "decimal",
    precision: 8,
    scale: 2,
    nullable: true,
  })
  originalScore!: string | null;
  @Column({
    name: "candidate_position",
    type: "smallint",
    unsigned: true,
    nullable: true,
  })
  candidatePosition!: number | null;
  @Column({ type: "varchar", length: 50 }) algorithm!: string;
  @Column({ type: "boolean" }) accepted!: boolean;
  @Column({ type: "boolean" }) corrected!: boolean;
  @CreateDateColumn({ name: "created_at", type: "datetime", precision: 6 })
  createdAt!: Date;
}

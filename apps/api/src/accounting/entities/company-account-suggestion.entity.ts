import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { CompanyAccountEntity } from "../../company-account-plan/entities/company-account.entity";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { UserEntity } from "../../users/entities/user.entity";

export enum CompanyAccountSuggestionStatus {
  ACTIVE = "active",
  REVIEW = "review",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  SUPERSEDED = "superseded",
}

@Entity({ name: "company_account_suggestions" })
@Index("idx_suggestions_account_status", [
  "companyAccountId",
  "status",
  "suggestionRank",
])
export class CompanyAccountSuggestionEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "company_account_id", type: "char", length: 36 })
  companyAccountId!: string;
  @Column({ name: "sii_account_id", type: "char", length: 36 })
  siiAccountId!: string;
  @Column({ name: "suggestion_rank", type: "smallint", unsigned: true })
  suggestionRank!: number;
  @Column({ type: "decimal", precision: 8, scale: 2 }) score!: string;
  @Column({ type: "decimal", precision: 5, scale: 4 }) confidence!: string;
  @Column({ name: "algorithm_version", type: "varchar", length: 50 })
  algorithmVersion!: string;
  @Column({ type: "json" }) reasons!: Array<{
    signal: string;
    description: string;
    points: number;
  }>;
  @Column({
    type: "enum",
    enum: CompanyAccountSuggestionStatus,
    default: CompanyAccountSuggestionStatus.ACTIVE,
  })
  status!: CompanyAccountSuggestionStatus;
  @Column({ name: "generated_at", type: "datetime", precision: 6 })
  generatedAt!: Date;
  @Column({
    name: "reviewed_by_user_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  reviewedByUserId!: string | null;
  @Column({
    name: "reviewed_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  reviewedAt!: Date | null;
  @CreateDateColumn({ name: "created_at", type: "datetime", precision: 6 })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "datetime", precision: 6 })
  updatedAt!: Date;

  @ManyToOne(() => CompanyAccountEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "company_account_id" })
  companyAccount!: CompanyAccountEntity;
  @ManyToOne(() => SiiAccountEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "sii_account_id" })
  siiAccount!: SiiAccountEntity;
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "reviewed_by_user_id" })
  reviewedByUser!: UserEntity | null;
}

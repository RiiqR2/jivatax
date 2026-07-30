import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";

export type LearningScope = "company" | "industry" | "global";

@Entity({ name: "account_matching_learning" })
@Index(
  "uq_account_matching_learning_identity",
  ["scope", "companyId", "industry", "normalizedName", "siiAccountId"],
  { unique: true },
)
export class AccountMatchingLearningEntity extends BaseEntity {
  @Column({ type: "enum", enum: ["company", "industry", "global"] })
  scope!: LearningScope;
  @Column({ name: "company_id", type: "char", length: 36, nullable: true })
  companyId!: string | null;
  @Column({ type: "varchar", length: 255, nullable: true }) industry!:
    string | null;
  @Column({ name: "internal_name", type: "varchar", length: 500 })
  internalName!: string;
  @Column({ name: "normalized_name", type: "varchar", length: 500 })
  normalizedName!: string;
  @Column({ name: "sii_account_id", type: "char", length: 36 })
  siiAccountId!: string;
  @Column({
    name: "confirmation_count",
    type: "int",
    unsigned: true,
    default: 1,
  })
  confirmationCount!: number;
  @Column({
    name: "distinct_company_count",
    type: "int",
    unsigned: true,
    default: 1,
  })
  distinctCompanyCount!: number;
  @Column({ name: "last_confirmed_at", type: "datetime", precision: 6 })
  lastConfirmedAt!: Date;
  @Column({ name: "last_confirmed_by_user_id", type: "char", length: 36 })
  lastConfirmedByUserId!: string;
  @Column({ name: "promotion_eligible", type: "boolean", default: false })
  promotionEligible!: boolean;
  @Column({ type: "boolean", default: true }) active!: boolean;
}

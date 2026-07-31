import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";

@Entity({ name: "account_matching_learning" })
@Index(
  "uq_account_matching_learning_global",
  ["normalizedNameHash", "siiAccountId"],
  { unique: true },
)
export class AccountMatchingLearningEntity extends BaseEntity {
  @Column({ name: "normalized_name", type: "varchar", length: 500 })
  normalizedName!: string;
  @Column({ name: "normalized_name_hash", type: "char", length: 64 })
  normalizedNameHash!: string;
  @Column({ name: "sii_account_id", type: "char", length: 36 })
  siiAccountId!: string;
  @Column({ name: "confirmation_count", type: "int", unsigned: true })
  confirmationCount!: number;
  @Column({ name: "distinct_company_count", type: "int", unsigned: true })
  distinctCompanyCount!: number;
  @Column({ name: "agreement_rate", type: "decimal", precision: 8, scale: 6 })
  agreementRate!: string;
  @Column({ type: "decimal", precision: 8, scale: 6 }) confidence!: string;
  @Column({ name: "last_confirmed_at", type: "datetime", precision: 6 })
  lastConfirmedAt!: Date;
}

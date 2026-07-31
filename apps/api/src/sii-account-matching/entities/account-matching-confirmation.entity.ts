import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { IndustryEntity } from "../../industries/entities/industry.entity";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { BaseEntity } from "../../common/entities/base.entity";

export enum ConfirmationSource {
  USER = "user",
  EXPERT = "expert",
  IMPORT = "import",
}
@Entity({ name: "account_matching_confirmations" })
@Index("idx_confirmations_learning", [
  "normalizedNameHash",
  "siiAccountId",
  "invalidatedAt",
])
export class AccountMatchingConfirmationEntity extends BaseEntity {
  @Column({ name: "company_id", type: "char", length: 36, nullable: true })
  companyId!: string | null;
  @Column({ name: "industry_id", type: "char", length: 36, nullable: true })
  industryId!: string | null;
  @Column({
    name: "company_account_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  companyAccountId!: string | null;
  @Column({
    name: "internal_account_code",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  internalAccountCode!: string | null;
  @Column({ name: "original_name", type: "varchar", length: 500 })
  originalName!: string;
  @Column({ name: "normalized_name", type: "varchar", length: 500 })
  normalizedName!: string;
  @Column({ name: "normalized_name_hash", type: "char", length: 64 })
  normalizedNameHash!: string;
  @Column({ name: "sii_account_id", type: "char", length: 36 })
  siiAccountId!: string;
  @Column({ type: "enum", enum: ConfirmationSource })
  source!: ConfirmationSource;
  @Column({
    name: "confirmed_by_user_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  confirmedByUserId!: string | null;
  @Column({ name: "confirmed_at", type: "datetime", precision: 6 })
  confirmedAt!: Date;
  @Column({
    name: "invalidated_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  invalidatedAt!: Date | null;
  @Column({
    name: "invalidated_by_user_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  invalidatedByUserId!: string | null;
  @Column({
    name: "invalidation_reason",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  invalidationReason!: string | null;
  @ManyToOne(() => IndustryEntity, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "industry_id" })
  industry!: IndustryEntity | null;
  @ManyToOne(() => SiiAccountEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "sii_account_id" })
  siiAccount!: SiiAccountEntity;
}

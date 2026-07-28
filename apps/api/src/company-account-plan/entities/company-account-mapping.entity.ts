import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import {
  CompanyAccountMappingMethod,
  CompanyAccountMappingStatus,
} from "../enums/company-account-plan.enums";
import { CompanyAccountEntity } from "./company-account.entity";

@Entity({ name: "company_account_mappings" })
@Index("uq_company_account_mappings_company_account_id", ["companyAccountId"], {
  unique: true,
})
@Index("idx_company_account_mappings_sii_account_id", ["siiAccountId"])
@Index("idx_company_account_mappings_status", ["status"])
@Index("idx_company_account_mappings_method", ["mappingMethod"])
@Index("idx_company_account_mappings_confidence", ["confidence"])
@Check(
  "chk_company_account_mappings_confidence",
  "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
)
export class CompanyAccountMappingEntity extends BaseEntity {
  @Column({ name: "company_account_id", type: "char", length: 36 })
  companyAccountId!: string;

  @Column({ name: "sii_account_id", type: "char", length: 36, nullable: true })
  siiAccountId!: string | null;

  @Column({ type: "enum", enum: CompanyAccountMappingStatus })
  status!: CompanyAccountMappingStatus;

  @Column({
    name: "mapping_method",
    type: "enum",
    enum: CompanyAccountMappingMethod,
  })
  mappingMethod!: CompanyAccountMappingMethod;

  @Column({ type: "decimal", precision: 5, scale: 4, nullable: true })
  confidence!: string | null;

  @Column({ type: "text", nullable: true })
  notes!: string | null;

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

  @Column({
    name: "suggested_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  suggestedAt!: Date | null;

  @OneToOne(() => CompanyAccountEntity, (account) => account.mapping, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "company_account_id",
    foreignKeyConstraintName: "fk_company_account_mappings_company_account_id",
  })
  companyAccount!: CompanyAccountEntity;

  @ManyToOne(() => SiiAccountEntity, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({
    name: "sii_account_id",
    foreignKeyConstraintName: "fk_company_account_mappings_sii_account_id",
  })
  siiAccount!: SiiAccountEntity | null;
}

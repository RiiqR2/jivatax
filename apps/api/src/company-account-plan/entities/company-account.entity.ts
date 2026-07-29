import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { CompanyAccountStatus } from "../enums/company-account-plan.enums";
import { CompanyAccountMappingEntity } from "./company-account-mapping.entity";
import { CompanyAccountPlanVersionEntity } from "./company-account-plan-version.entity";

@Entity({ name: "company_accounts" })
@Index(
  "uq_company_accounts_version_internal_code",
  ["companyAccountPlanVersionId", "internalCode"],
  {
    unique: true,
  },
)
@Index("idx_company_accounts_company_id", ["companyId"])
@Index("idx_company_accounts_version_id", ["companyAccountPlanVersionId"])
@Index("idx_company_accounts_parent_id", ["parentId"])
@Index("idx_company_accounts_name", ["name"])
@Index("idx_company_accounts_internal_code", ["internalCode"])
@Index("uq_company_accounts_company_code", ["companyId", "internalCode"], {
  unique: true,
})
export class CompanyAccountEntity extends BaseEntity {
  @Column({
    name: "company_account_plan_version_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  companyAccountPlanVersionId!: string | null;

  @Column({ name: "company_id", type: "char", length: 36 })
  companyId!: string;

  @Column({ name: "internal_code", type: "varchar", length: 100 })
  internalCode!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "smallint", unsigned: true, nullable: true })
  level!: number | null;

  @Column({ name: "parent_id", type: "char", length: 36, nullable: true })
  parentId!: string | null;

  @Column({ name: "sort_order", type: "int", unsigned: true })
  sortOrder!: number;

  @Column({ name: "source_row_number", type: "int", unsigned: true })
  sourceRowNumber!: number;

  @Column({ name: "raw_data", type: "json", nullable: true })
  rawData!: Record<string, unknown> | null;

  @Column({
    type: "enum",
    enum: CompanyAccountStatus,
    default: CompanyAccountStatus.ACTIVE,
  })
  status!: CompanyAccountStatus;

  @Column({
    name: "first_seen_tax_period_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  firstSeenTaxPeriodId!: string | null;

  @Column({
    name: "last_seen_tax_period_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  lastSeenTaxPeriodId!: string | null;

  @Column({
    name: "first_seen_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  firstSeenAt!: Date | null;

  @Column({
    name: "last_seen_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  lastSeenAt!: Date | null;

  @ManyToOne(
    () => CompanyAccountPlanVersionEntity,
    (version) => version.accounts,
    {
      onDelete: "RESTRICT",
    },
  )
  @JoinColumn({
    name: "company_account_plan_version_id",
    foreignKeyConstraintName: "fk_company_accounts_version_id",
  })
  version!: CompanyAccountPlanVersionEntity;

  @ManyToOne(() => CompanyEntity, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "company_id",
    foreignKeyConstraintName: "fk_company_accounts_company_id",
  })
  company!: CompanyEntity;

  @ManyToOne(() => CompanyAccountEntity, {
    nullable: true,
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "parent_id",
    foreignKeyConstraintName: "fk_company_accounts_parent_id",
  })
  parent!: CompanyAccountEntity | null;

  @OneToOne(
    () => CompanyAccountMappingEntity,
    (mapping) => mapping.companyAccount,
  )
  mapping!: CompanyAccountMappingEntity;
}

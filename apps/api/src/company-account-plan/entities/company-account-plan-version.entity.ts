import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { AuditableEntity } from "../../common/entities/auditable.entity";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { CompanyAccountPlanVersionStatus } from "../enums/company-account-plan.enums";
import { CompanyAccountEntity } from "./company-account.entity";

@Entity({
  name: "company_account_plan_versions",
})
@Index(
  "uq_company_account_plan_versions_company_checksum",
  ["companyId", "sourceChecksum"],
  {
    unique: true,
  },
)
@Index("idx_company_account_plan_versions_company_id", ["companyId"])
@Index("idx_company_account_plan_versions_status", ["status"])
@Index("idx_company_account_plan_versions_created_at", ["createdAt"])
export class CompanyAccountPlanVersionEntity extends AuditableEntity {
  @Column({ name: "company_id", type: "char", length: 36 })
  companyId!: string;

  @Column({ type: "varchar", length: 255 })
  name!: string;

  @Column({ name: "source_file_name", type: "varchar", length: 255 })
  sourceFileName!: string;

  @Column({ name: "source_checksum", type: "varchar", length: 128 })
  sourceChecksum!: string;

  @Column({
    type: "enum",
    enum: CompanyAccountPlanVersionStatus,
    default: CompanyAccountPlanVersionStatus.DRAFT,
  })
  status!: CompanyAccountPlanVersionStatus;

  @Column({
    name: "imported_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  importedAt!: Date | null;

  @Column({
    name: "processed_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  processedAt!: Date | null;

  @Column({ name: "failure_reason", type: "text", nullable: true })
  failureReason!: string | null;

  @Column({ name: "total_rows", type: "int", unsigned: true, default: 0 })
  totalRows!: number;

  @Column({ name: "valid_rows", type: "int", unsigned: true, default: 0 })
  validRows!: number;

  @Column({ name: "invalid_rows", type: "int", unsigned: true, default: 0 })
  invalidRows!: number;

  @ManyToOne(() => CompanyEntity, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "company_id",
    foreignKeyConstraintName: "fk_company_account_plan_versions_company_id",
  })
  company!: CompanyEntity;

  @OneToMany(() => CompanyAccountEntity, (account) => account.version)
  accounts!: CompanyAccountEntity[];
}

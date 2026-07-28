import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { AuditableEntity } from "../../common/entities/auditable.entity";
import { CompanyEntity } from "../../companies/entities/company.entity";

export enum StoredFileDirection {
  INPUT = "input",
  OUTPUT = "output",
}

export enum StoredFileCategory {
  BALANCE = "balance",
  JOURNAL = "journal",
  LEDGER = "ledger",
  XML = "xml",
  DECLARATION = "declaration",
  REPORT = "report",
  COMPANY_ACCOUNT_PLAN = "company_account_plan",
  OTHER = "other",
}

export enum StoredFileStatus {
  UPLOADED = "uploaded",
  PROCESSING = "processing",
  PROCESSED = "processed",
  FAILED = "failed",
  GENERATED = "generated",
}

@Entity({ name: "stored_files" })
@Index("uq_stored_files_bucket_object_key", ["bucket", "objectKey"], {
  unique: true,
})
@Index("idx_stored_files_company_id", ["companyId"])
@Index("idx_stored_files_company_direction", ["companyId", "direction"])
@Index("idx_stored_files_company_category", ["companyId", "category"])
@Index("idx_stored_files_company_status", ["companyId", "status"])
export class StoredFileEntity extends AuditableEntity {
  @Column({
    name: "company_id",
    type: "char",
    length: 36,
  })
  companyId!: string;

  @Column({
    type: "varchar",
    length: 100,
  })
  bucket!: string;

  @Column({
    name: "object_key",
    type: "varchar",
    length: 500,
  })
  objectKey!: string;

  @Column({
    name: "original_name",
    type: "varchar",
    length: 255,
  })
  originalName!: string;

  @Column({
    type: "varchar",
    length: 20,
  })
  extension!: string;

  @Column({
    name: "content_type",
    type: "varchar",
    length: 255,
  })
  contentType!: string;

  @Column({
    name: "size_bytes",
    type: "bigint",
    unsigned: true,
  })
  sizeBytes!: string;

  @Column({
    type: "enum",
    enum: StoredFileDirection,
    default: StoredFileDirection.INPUT,
  })
  direction!: StoredFileDirection;

  @Column({
    type: "enum",
    enum: StoredFileCategory,
  })
  category!: StoredFileCategory;

  @Column({
    type: "enum",
    enum: StoredFileStatus,
    default: StoredFileStatus.UPLOADED,
  })
  status!: StoredFileStatus;

  @ManyToOne(() => CompanyEntity, (company) => company.storedFiles, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "company_id",
    foreignKeyConstraintName: "fk_stored_files_company_id",
  })
  company!: CompanyEntity;
}

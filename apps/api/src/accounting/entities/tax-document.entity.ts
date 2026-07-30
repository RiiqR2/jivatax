import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { StoredFileEntity } from "../../files/entities/stored-file.entity";
import { TaxDocumentStatus, TaxDocumentType } from "../enums/accounting.enums";
import { TaxPeriodEntity } from "./tax-period.entity";
import { UserEntity } from "../../users/entities/user.entity";

@Entity({ name: "tax_documents" })
@Index(
  "uq_tax_documents_version",
  ["companyId", "taxPeriodId", "documentType", "versionNumber"],
  { unique: true },
)
export class TaxDocumentEntity extends BaseEntity {
  @Column({ name: "company_id", type: "char", length: 36 }) companyId!: string;
  @Column({ name: "tax_period_id", type: "char", length: 36 })
  taxPeriodId!: string;
  @Column({ name: "stored_file_id", type: "char", length: 36 })
  storedFileId!: string;
  @Column({ name: "document_type", type: "enum", enum: TaxDocumentType })
  documentType!: TaxDocumentType;
  @Column({
    type: "enum",
    enum: TaxDocumentStatus,
    default: TaxDocumentStatus.UPLOADED,
  })
  status!: TaxDocumentStatus;
  @Column({ name: "version_number", type: "int", unsigned: true })
  versionNumber!: number;
  @Column({
    name: "replaces_document_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  replacesDocumentId!: string | null;
  @Column({ name: "uploaded_by_user_id", type: "char", length: 36 })
  uploadedByUserId!: string;
  @Column({ name: "uploaded_at", type: "datetime", precision: 6 })
  uploadedAt!: Date;
  @Column({
    name: "validated_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  validatedAt!: Date | null;
  @Column({
    name: "processed_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  processedAt!: Date | null;
  @Column({ name: "error_summary", type: "text", nullable: true })
  errorSummary!: string | null;
  @Column({ name: "warning_summary", type: "text", nullable: true })
  warningSummary!: string | null;
  @Column({
    name: "discarded_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  discardedAt!: Date | null;
  @Column({
    name: "discarded_by_user_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  discardedByUserId!: string | null;
  @Column({
    name: "discard_reason",
    type: "varchar",
    length: 1000,
    nullable: true,
  })
  discardReason!: string | null;
  @Column({
    name: "status_before_discard",
    type: "varchar",
    length: 40,
    nullable: true,
  })
  statusBeforeDiscard!: string | null;
  @Column({ type: "json", nullable: true }) metadata!: Record<
    string,
    unknown
  > | null;

  @ManyToOne(() => TaxPeriodEntity, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "tax_period_id",
    foreignKeyConstraintName: "fk_tax_documents_period",
  })
  taxPeriod!: TaxPeriodEntity;
  @ManyToOne(() => StoredFileEntity, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "stored_file_id",
    foreignKeyConstraintName: "fk_tax_documents_file",
  })
  storedFile!: StoredFileEntity;

  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "uploaded_by_user_id" })
  uploadedByUser!: UserEntity;
}

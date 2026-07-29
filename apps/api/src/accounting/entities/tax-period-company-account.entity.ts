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
import { TaxDocumentEntity } from "./tax-document.entity";
import { TaxPeriodEntity } from "./tax-period.entity";

@Entity({ name: "tax_period_company_accounts" })
@Index("uq_period_company_account", ["taxPeriodId", "companyAccountId"], {
  unique: true,
})
export class TaxPeriodCompanyAccountEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "company_id", type: "char", length: 36 }) companyId!: string;
  @Column({ name: "tax_period_id", type: "char", length: 36 })
  taxPeriodId!: string;
  @Column({ name: "company_account_id", type: "char", length: 36 })
  companyAccountId!: string;
  @Column({ name: "source_document_id", type: "char", length: 36 })
  sourceDocumentId!: string;
  @Column({
    name: "balance_entry_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  balanceEntryId!: string | null;
  @Column({ name: "account_code_snapshot", type: "varchar", length: 100 })
  accountCodeSnapshot!: string;
  @Column({ name: "account_name_snapshot", type: "varchar", length: 255 })
  accountNameSnapshot!: string;
  @Column({ name: "debit_amount", type: "decimal", precision: 24, scale: 4 })
  debitAmount!: string;
  @Column({ name: "credit_amount", type: "decimal", precision: 24, scale: 4 })
  creditAmount!: string;
  @Column({ name: "debit_balance", type: "decimal", precision: 24, scale: 4 })
  debitBalance!: string;
  @Column({ name: "credit_balance", type: "decimal", precision: 24, scale: 4 })
  creditBalance!: string;
  @Column({ name: "asset_amount", type: "decimal", precision: 24, scale: 4 })
  assetAmount!: string;
  @Column({
    name: "liability_amount",
    type: "decimal",
    precision: 24,
    scale: 4,
  })
  liabilityAmount!: string;
  @Column({ name: "loss_amount", type: "decimal", precision: 24, scale: 4 })
  lossAmount!: string;
  @Column({ name: "gain_amount", type: "decimal", precision: 24, scale: 4 })
  gainAmount!: string;
  @Column({ name: "first_seen_at", type: "datetime", precision: 6 })
  firstSeenAt!: Date;
  @Column({ name: "last_seen_at", type: "datetime", precision: 6 })
  lastSeenAt!: Date;

  @CreateDateColumn({ name: "created_at", type: "datetime", precision: 6 })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "datetime", precision: 6 })
  updatedAt!: Date;

  @ManyToOne(() => TaxPeriodEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "tax_period_id" })
  taxPeriod!: TaxPeriodEntity;
  @ManyToOne(() => CompanyAccountEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "company_account_id" })
  companyAccount!: CompanyAccountEntity;
  @ManyToOne(() => TaxDocumentEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "source_document_id" })
  sourceDocument!: TaxDocumentEntity;
}

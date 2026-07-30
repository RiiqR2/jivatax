import { Column, Entity, Index, JoinColumn, OneToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type {
  BalanceNature,
  StatementSection,
} from "../account-matching.types";

export type KnowledgeTaxType =
  | "none"
  | "iva_credit"
  | "iva_debit"
  | "ppm"
  | "withholding"
  | "income_tax"
  | "specific_tax"
  | "other_tax";
export type KnowledgeFinancialType =
  | "none"
  | "cash"
  | "receivable"
  | "payable"
  | "financing"
  | "financial_income"
  | "financial_expense";

/** Administrable accounting attributes for a real sii_accounts row. */
@Entity({ name: "sii_account_knowledge" })
@Index("uq_sii_account_knowledge_account", ["siiAccountId"], { unique: true })
export class SiiAccountKnowledgeEntity extends BaseEntity {
  @Column({ name: "sii_account_id", type: "char", length: 36 })
  siiAccountId!: string;
  @Column({ name: "accounting_family", type: "varchar", length: 100 })
  accountingFamily!: string;
  @Column({ name: "statement_section", type: "varchar", length: 30 })
  statementSection!: StatementSection;
  @Column({ name: "balance_nature", type: "varchar", length: 10 })
  balanceNature!: BalanceNature;
  @Column({ name: "tax_type", type: "varchar", length: 40, default: "none" })
  taxType!: KnowledgeTaxType;
  @Column({
    name: "financial_type",
    type: "varchar",
    length: 40,
    default: "none",
  })
  financialType!: KnowledgeFinancialType;
  @Column({ name: "is_control_account", type: "boolean", default: false })
  isControlAccount!: boolean;
  @Column({ name: "is_contra_account", type: "boolean", default: false })
  isContraAccount!: boolean;
  @Column({ name: "is_current", type: "boolean", nullable: true }) isCurrent!:
    boolean | null;
  @Column({ name: "is_residual", type: "boolean", default: false })
  isResidual!: boolean;
  @Column({ name: "attributes", type: "json", nullable: true })
  attributes!: Record<string, boolean | string | number> | null;
  @Column({ type: "varchar", length: 100, default: "manual" }) source!: string;
  @Column({ type: "boolean", default: true }) active!: boolean;

  @OneToOne(() => SiiAccountEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "sii_account_id" })
  siiAccount!: SiiAccountEntity;
}

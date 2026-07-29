import { Column, Entity, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";

export type SiiAccountTermType =
  | "official_name"
  | "alias"
  | "abbreviation"
  | "manual_term"
  | "erp_term"
  | "industry_term"
  | "negative_term";

@Entity({ name: "sii_account_terms" })
export class SiiAccountTermEntity extends BaseEntity {
  @Column({ name: "sii_account_id", type: "char", length: 36 })
  siiAccountId!: string;
  @Column({ name: "company_id", type: "char", length: 36, nullable: true })
  companyId!: string | null;
  @Column({ type: "enum", enum: ["global", "company"] })
  scope!: "global" | "company";
  @Column({ type: "varchar", length: 500 }) term!: string;
  @Column({ name: "normalized_term", type: "varchar", length: 500 })
  normalizedTerm!: string;
  @Column({
    type: "enum",
    enum: [
      "official_name",
      "alias",
      "abbreviation",
      "manual_term",
      "erp_term",
      "industry_term",
      "negative_term",
    ],
  })
  type!: SiiAccountTermType;
  @Column({ type: "decimal", precision: 7, scale: 2 }) weight!: number;
  @Column({ type: "varchar", length: 100 }) source!: string;
  @Column({ type: "boolean", default: true }) active!: boolean;
  @ManyToOne(() => SiiAccountEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "sii_account_id" })
  siiAccount!: SiiAccountEntity;
  @ManyToOne(() => CompanyEntity, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "company_id" })
  company!: CompanyEntity | null;
}

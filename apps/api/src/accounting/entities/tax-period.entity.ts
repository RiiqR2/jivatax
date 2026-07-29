import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { TaxPeriodStatus } from "../enums/accounting.enums";

@Entity({ name: "tax_periods" })
@Index("uq_tax_periods_company_tax_year", ["companyId", "taxYear"], {
  unique: true,
})
export class TaxPeriodEntity extends BaseEntity {
  @Column({ name: "company_id", type: "char", length: 36 }) companyId!: string;
  @Column({ name: "commercial_year", type: "smallint" })
  commercialYear!: number;
  @Column({ name: "tax_year", type: "smallint" }) taxYear!: number;
  @Column({ name: "start_date", type: "date" }) startDate!: string;
  @Column({ name: "end_date", type: "date" }) endDate!: string;
  @Column({
    type: "enum",
    enum: TaxPeriodStatus,
    default: TaxPeriodStatus.OPEN,
  })
  status!: TaxPeriodStatus;
  @Column({ name: "tax_regime", type: "varchar", length: 100, nullable: true })
  taxRegime!: string | null;
  @Column({ type: "varchar", length: 3, default: "CLP" }) currency!: string;
  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @ManyToOne(() => CompanyEntity, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "company_id",
    foreignKeyConstraintName: "fk_tax_periods_company",
  })
  company!: CompanyEntity;
}

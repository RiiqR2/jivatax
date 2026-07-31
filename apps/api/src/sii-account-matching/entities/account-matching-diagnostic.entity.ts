import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";

@Entity({ name: "account_matching_diagnostics" })
@Index("idx_account_matching_diagnostics_period", [
  "companyId",
  "taxPeriodId",
  "generatedAt",
])
export class AccountMatchingDiagnosticEntity extends BaseEntity {
  @Column({ name: "company_id", type: "char", length: 36 }) companyId!: string;
  @Column({ name: "tax_period_id", type: "char", length: 36 })
  taxPeriodId!: string;
  @Column({ name: "company_account_id", type: "char", length: 36 })
  companyAccountId!: string;
  @Column({ name: "account_name", type: "varchar", length: 500 })
  accountName!: string;
  @Column({ name: "normalized_name", type: "varchar", length: 500 })
  normalizedName!: string;
  @Column({ name: "observed_section", type: "varchar", length: 30 })
  observedSection!: string;
  @Column({ type: "varchar", length: 30 }) decision!: string;
  @Column({ name: "decision_reason", type: "varchar", length: 100 })
  decisionReason!: string;
  @Column({ name: "algorithm_version", type: "varchar", length: 50 })
  algorithmVersion!: string;
  @Column({ type: "json" }) candidates!: unknown[];
  @Column({ name: "discarded_candidates", type: "json" })
  discardedCandidates!: unknown[];
  @Column({ name: "rules_evaluated", type: "json" })
  rulesEvaluated!: string[];
  @Column({ name: "generated_at", type: "datetime", precision: 6 })
  generatedAt!: Date;
}

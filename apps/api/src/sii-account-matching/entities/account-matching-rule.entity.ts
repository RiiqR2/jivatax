import { Column, Entity, Index } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";

export type RuleCondition = {
  sourcePattern?: string;
  sourceFamily?: string;
  observedSection?: string;
  candidateFamily?: string;
  candidateSection?: string;
  candidateTaxType?: string;
  candidateFinancialType?: string;
};
export type RuleAction = {
  type: "include" | "exclude" | "score" | "review";
  points?: number;
};

@Entity({ name: "account_matching_rules" })
@Index("uq_account_matching_rules_key", ["ruleKey"], { unique: true })
@Index("idx_account_matching_rules_active_priority", ["active", "priority"])
export class AccountMatchingRuleEntity extends BaseEntity {
  @Column({ name: "rule_key", type: "varchar", length: 100 }) ruleKey!: string;
  @Column({ type: "varchar", length: 255 }) name!: string;
  @Column({ type: "int" }) priority!: number;
  @Column({ type: "json" }) condition!: RuleCondition;
  @Column({ type: "json" }) action!: RuleAction;
  @Column({ type: "varchar", length: 500 }) explanation!: string;
  @Column({ type: "boolean", default: true }) active!: boolean;
}

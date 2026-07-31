import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { IndustryEntity } from "../../industries/entities/industry.entity";
import { AccountMatchingLearningEntity } from "./account-matching-learning.entity";
@Entity({ name: "account_matching_learning_industries" })
@Index("uq_learning_industry", ["learningId", "industryId"], { unique: true })
export class AccountMatchingLearningIndustryEntity extends BaseEntity {
  @Column({ name: "learning_id", type: "char", length: 36 })
  learningId!: string;
  @Column({ name: "industry_id", type: "char", length: 36 })
  industryId!: string;
  @Column({ name: "confirmation_count", type: "int", unsigned: true })
  confirmationCount!: number;
  @Column({
    name: "expert_confirmation_count",
    type: "int",
    unsigned: true,
    default: 0,
  })
  expertConfirmationCount!: number;
  @Column({ name: "distinct_company_count", type: "int", unsigned: true })
  distinctCompanyCount!: number;
  @Column({ name: "agreement_rate", type: "decimal", precision: 8, scale: 6 })
  agreementRate!: string;
  @Column({ type: "decimal", precision: 8, scale: 6 }) confidence!: string;
  @Column({ name: "last_confirmed_at", type: "datetime", precision: 6 })
  lastConfirmedAt!: Date;
  @ManyToOne(() => AccountMatchingLearningEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "learning_id" })
  learning!: AccountMatchingLearningEntity;
  @ManyToOne(() => IndustryEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "industry_id" })
  industry!: IndustryEntity;
}

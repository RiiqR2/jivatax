import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { CompanyAccountEntity } from "../../company-account-plan/entities/company-account.entity";
import { CompanyAccountMappingStatus } from "../../company-account-plan/enums/company-account-plan.enums";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { UserEntity } from "../../users/entities/user.entity";

@Entity({ name: "company_account_mapping_history" })
export class CompanyAccountMappingHistoryEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "company_account_id", type: "char", length: 36 })
  companyAccountId!: string;
  @Column({
    name: "previous_sii_account_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  previousSiiAccountId!: string | null;
  @Column({
    name: "new_sii_account_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  newSiiAccountId!: string | null;
  @Column({
    name: "previous_status",
    type: "varchar",
    length: 30,
    nullable: true,
  })
  previousStatus!: CompanyAccountMappingStatus | null;
  @Column({ name: "new_status", type: "varchar", length: 30 })
  newStatus!: CompanyAccountMappingStatus;
  @Column({ name: "changed_by_user_id", type: "char", length: 36 })
  changedByUserId!: string;
  @Column({ type: "text", nullable: true }) reason!: string | null;
  @CreateDateColumn({ name: "created_at", type: "datetime", precision: 6 })
  createdAt!: Date;
  @ManyToOne(() => CompanyAccountEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "company_account_id" })
  companyAccount!: CompanyAccountEntity;
  @ManyToOne(() => SiiAccountEntity, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "previous_sii_account_id" })
  previousSiiAccount!: SiiAccountEntity | null;
  @ManyToOne(() => SiiAccountEntity, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "new_sii_account_id" })
  newSiiAccount!: SiiAccountEntity | null;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "changed_by_user_id" })
  changedByUser!: UserEntity;
}

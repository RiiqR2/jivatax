import { Column, Entity, Index, OneToMany } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { SiiAccountPlanVersionStatus } from "../enums/sii-account-plan-version-status.enum";
import { SiiAccountEntity } from "./sii-account.entity";

@Entity({
  name: "sii_account_plan_versions",
})
@Index("uq_sii_account_plan_versions_code", ["code"], {
  unique: true,
})
@Index("uq_sii_account_plan_versions_checksum", ["sourceChecksum"], {
  unique: true,
})
export class SiiAccountPlanVersionEntity extends BaseEntity {
  @Column({
    type: "varchar",
    length: 100,
  })
  code!: string;

  @Column({
    type: "varchar",
    length: 255,
  })
  name!: string;

  @Column({
    name: "source_file_name",
    type: "varchar",
    length: 255,
  })
  sourceFileName!: string;

  @Column({
    name: "source_reference",
    type: "varchar",
    length: 500,
    nullable: true,
  })
  sourceReference!: string | null;

  @Column({
    name: "source_checksum",
    type: "varchar",
    length: 128,
  })
  sourceChecksum!: string;

  @Column({
    name: "effective_from",
    type: "date",
    nullable: true,
  })
  effectiveFrom!: string | null;

  @Column({
    name: "effective_to",
    type: "date",
    nullable: true,
  })
  effectiveTo!: string | null;

  @Column({
    type: "enum",
    enum: SiiAccountPlanVersionStatus,
    default: SiiAccountPlanVersionStatus.DRAFT,
  })
  status!: SiiAccountPlanVersionStatus;

  @Column({
    name: "imported_at",
    type: "datetime",
    precision: 6,
  })
  importedAt!: Date;

  @OneToMany(() => SiiAccountEntity, (account) => account.version)
  accounts!: SiiAccountEntity[];
}

import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseEntity } from "../../common/entities/base.entity";
import { SiiAccountPlanVersionEntity } from "./sii-account-plan-version.entity";

@Entity({
  name: "sii_accounts",
})
@Index("uq_sii_accounts_version_code", ["versionId", "code"], {
  unique: true,
})
@Index("idx_sii_accounts_version_id", ["versionId"])
@Index("idx_sii_accounts_parent_id", ["parentId"])
@Index("idx_sii_accounts_name", ["name"])
@Index("idx_sii_accounts_sort_order", ["sortOrder"])
export class SiiAccountEntity extends BaseEntity {
  @Column({
    name: "version_id",
    type: "char",
    length: 36,
  })
  versionId!: string;

  @Column({
    type: "varchar",
    length: 100,
  })
  code!: string;

  @Column({
    type: "varchar",
    length: 500,
  })
  name!: string;

  @Column({
    type: "text",
    nullable: true,
  })
  description!: string | null;

  @Column({
    type: "smallint",
    unsigned: true,
    nullable: true,
  })
  level!: number | null;

  @Column({
    name: "parent_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  parentId!: string | null;

  @Column({
    name: "sort_order",
    type: "int",
    unsigned: true,
  })
  sortOrder!: number;

  @Column({
    name: "source_row_number",
    type: "int",
    unsigned: true,
  })
  sourceRowNumber!: number;

  @Column({
    name: "raw_data",
    type: "json",
    nullable: true,
  })
  rawData!: Record<string, unknown> | null;

  @ManyToOne(() => SiiAccountPlanVersionEntity, (version) => version.accounts, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "version_id",
    foreignKeyConstraintName: "fk_sii_accounts_version_id",
  })
  version!: SiiAccountPlanVersionEntity;

  @ManyToOne(() => SiiAccountEntity, {
    nullable: true,
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "parent_id",
    foreignKeyConstraintName: "fk_sii_accounts_parent_id",
  })
  parent!: SiiAccountEntity | null;
}

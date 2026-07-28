import { Column } from "typeorm";
import { BaseEntity } from "./base.entity";

export abstract class AuditableEntity extends BaseEntity {
  @Column({
    name: "created_by_user_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  createdByUserId!: string | null;

  @Column({
    name: "updated_by_user_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  updatedByUserId!: string | null;

  @Column({
    name: "deleted_by_user_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  deletedByUserId!: string | null;
}

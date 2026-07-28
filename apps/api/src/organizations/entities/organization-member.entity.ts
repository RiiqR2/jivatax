import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { AuditableEntity } from "../../common/entities/auditable.entity";
import { UserEntity } from "../../users/entities/user.entity";
import { OrganizationMemberStatus } from "../enums/organization-member-status.enum";
import { OrganizationRole } from "../enums/organization-role.enum";
import { OrganizationEntity } from "./organization.entity";

@Entity({ name: "organization_members" })
@Index(
  "uq_organization_members_organization_id_user_id",
  ["organizationId", "userId"],
  {
    unique: true,
  },
)
@Index("idx_organization_members_organization_id", ["organizationId"])
@Index("idx_organization_members_user_id", ["userId"])
export class OrganizationMemberEntity extends AuditableEntity {
  @Column({ name: "organization_id", type: "char", length: 36 })
  organizationId!: string;

  @Column({ name: "user_id", type: "char", length: 36 })
  userId!: string;

  @Column({ type: "enum", enum: OrganizationRole })
  role!: OrganizationRole;

  @Column({
    type: "enum",
    enum: OrganizationMemberStatus,
    default: OrganizationMemberStatus.INVITED,
  })
  status!: OrganizationMemberStatus;

  @Column({ name: "joined_at", type: "datetime", precision: 6, nullable: true })
  joinedAt!: Date | null;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.members, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "organization_id",
    foreignKeyConstraintName: "fk_organization_members_organization_id",
  })
  organization!: OrganizationEntity;

  @ManyToOne(() => UserEntity, (user) => user.organizationMembers, {
    onDelete: "RESTRICT",
  })
  @JoinColumn({
    name: "user_id",
    foreignKeyConstraintName: "fk_organization_members_user_id",
  })
  user!: UserEntity;
}

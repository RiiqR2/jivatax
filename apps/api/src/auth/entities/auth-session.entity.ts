import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserEntity } from "../../users/entities/user.entity";
@Entity({ name: "auth_sessions" })
@Index("idx_auth_sessions_user_id", ["userId"])
@Index("idx_auth_sessions_expires_at", ["expiresAt"])
@Index("idx_auth_sessions_revoked_at", ["revokedAt"])
@Index("idx_auth_sessions_replaced_by_session_id", ["replacedBySessionId"])
export class AuthSessionEntity {
  @PrimaryGeneratedColumn("uuid") id!: string;
  @Column({ name: "user_id", type: "char", length: 36 }) userId!: string;
  @Column({ name: "refresh_token_hash", type: "varchar", length: 255 })
  refreshTokenHash!: string;
  @Column({
    name: "current_organization_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  currentOrganizationId!: string | null;
  @Column({ name: "expires_at", type: "datetime", precision: 6 })
  expiresAt!: Date;
  @Column({
    name: "revoked_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  revokedAt!: Date | null;
  @Column({
    name: "replaced_by_session_id",
    type: "char",
    length: 36,
    nullable: true,
  })
  replacedBySessionId!: string | null;
  @CreateDateColumn({ name: "created_at", type: "datetime", precision: 6 })
  createdAt!: Date;
  @UpdateDateColumn({ name: "updated_at", type: "datetime", precision: 6 })
  updatedAt!: Date;
  @Column({
    name: "last_used_at",
    type: "datetime",
    precision: 6,
    nullable: true,
  })
  lastUsedAt!: Date | null;
  @Column({ name: "ip_address", type: "varchar", length: 45, nullable: true })
  ipAddress!: string | null;
  @Column({ name: "user_agent", type: "varchar", length: 500, nullable: true })
  userAgent!: string | null;
  @ManyToOne(() => UserEntity, { onDelete: "RESTRICT" })
  @JoinColumn({
    name: "user_id",
    foreignKeyConstraintName: "fk_auth_sessions_user_id",
  })
  user!: UserEntity;
  @ManyToOne(() => AuthSessionEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({
    name: "replaced_by_session_id",
    foreignKeyConstraintName: "fk_auth_sessions_replaced_by_session_id",
  })
  replacement!: AuthSessionEntity | null;
  @OneToMany(() => AuthSessionEntity, (session) => session.replacement)
  replacedSessions!: AuthSessionEntity[];
}

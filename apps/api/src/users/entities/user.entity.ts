import { Exclude } from 'class-transformer';
import { BeforeInsert, BeforeUpdate, Column, Entity, Index, OneToMany } from 'typeorm';
import { AuditableEntity } from '../../common/entities/auditable.entity';
import { OrganizationMemberEntity } from '../../organizations/entities/organization-member.entity';

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BLOCKED = 'blocked',
}

@Entity({ name: 'users' })
@Index('uq_users_email', ['email'], { unique: true })
export class UserEntity extends AuditableEntity {
  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  @Column({ name: 'last_login_at', type: 'datetime', precision: 6, nullable: true })
  lastLoginAt!: Date | null;

  @OneToMany(() => OrganizationMemberEntity, (member) => member.user)
  organizationMembers!: OrganizationMemberEntity[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail(): void {
    this.email = this.email.toLowerCase();
  }
}

import { Column, Entity, Index, OneToMany } from 'typeorm';
import { CompanyEntity } from '../../companies/entities/company.entity';
import { AuditableEntity } from '../../common/entities/auditable.entity';
import { OrganizationMemberEntity } from './organization-member.entity';

export enum OrganizationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity({ name: 'organizations' })
@Index('uq_organizations_slug', ['slug'], { unique: true })
export class OrganizationEntity extends AuditableEntity {
  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 150 })
  slug!: string;

  @Column({ type: 'enum', enum: OrganizationStatus, default: OrganizationStatus.ACTIVE })
  status!: OrganizationStatus;

  @OneToMany(() => OrganizationMemberEntity, (member) => member.organization)
  members!: OrganizationMemberEntity[];

  @OneToMany(() => CompanyEntity, (company) => company.organization)
  companies!: CompanyEntity[];
}

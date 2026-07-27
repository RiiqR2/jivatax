import { BeforeInsert, BeforeUpdate, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AuditableEntity } from '../../common/entities/auditable.entity';
import { OrganizationEntity } from '../../organizations/entities/organization.entity';
import { CompanyStatus } from '../enums/company-status.enum';
import { OneToMany } from 'typeorm';
import { StoredFileEntity } from '../../files/entities/stored-file.entity';

@Entity({ name: 'companies' })
@Index('uq_companies_organization_id_rut', ['organizationId', 'rut'], { unique: true })
@Index('idx_companies_organization_id', ['organizationId'])
export class CompanyEntity extends AuditableEntity {
  @Column({ name: 'organization_id', type: 'char', length: 36 })
  organizationId!: string;

  @Column({ type: 'varchar', length: 12 })
  rut!: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 255 })
  legalName!: string;

  @Column({ name: 'trade_name', type: 'varchar', length: 255, nullable: true })
  tradeName!: string | null;

  @Column({ name: 'business_activity', type: 'varchar', length: 255, nullable: true })
  businessActivity!: string | null;

  @Column({ type: 'enum', enum: CompanyStatus, default: CompanyStatus.ACTIVE })
  status!: CompanyStatus;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.companies, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'organization_id', foreignKeyConstraintName: 'fk_companies_organization_id' })
  organization!: OrganizationEntity;
  
  @OneToMany(
    () => StoredFileEntity,
    (storedFile) => storedFile.company,
  )
  storedFiles!: StoredFileEntity[];

  @BeforeInsert()
  @BeforeUpdate()
  normalizeRut(): void {
    this.rut = this.rut.replace(/[.\s]/g, '');
  }
}

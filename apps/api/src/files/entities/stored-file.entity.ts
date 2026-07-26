import { Column, Entity, Index } from 'typeorm';
import { AuditableEntity } from '../../common/entities/auditable.entity';

@Entity({ name: 'stored_files' })
@Index('uq_stored_files_bucket_object_key', ['bucket', 'objectKey'], {
  unique: true,
})
@Index('idx_stored_files_company_id', ['companyId'])
export class StoredFileEntity extends AuditableEntity {
  @Column({ type: 'varchar', length: 255 })
  bucket!: string;

  @Column({ name: 'object_key', type: 'varchar', length: 512 })
  objectKey!: string;

  @Column({ name: 'original_name', type: 'varchar', length: 255 })
  originalName!: string;

  @Column({ name: 'content_type', type: 'varchar', length: 150 })
  contentType!: string;

  @Column({ name: 'size_bytes', type: 'bigint', unsigned: true })
  sizeBytes!: string;

  @Column({
    name: 'company_id',
    type: 'char',
    length: 36,
    nullable: true,
  })
  companyId!: string | null;
}

import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'stored_files' })
export class StoredFileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  bucket!: string;

  @Column({ name: 'object_key', length: 1024, unique: true })
  objectKey!: string;

  @Column({ name: 'original_name', length: 255 })
  originalName!: string;

  @Column({ name: 'content_type', length: 150 })
  contentType!: string;

  @Column({ name: 'size_bytes', type: 'bigint', unsigned: true })
  sizeBytes!: string;

  @Column({ name: 'company_id', type: 'char', length: 36, nullable: true })
  companyId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

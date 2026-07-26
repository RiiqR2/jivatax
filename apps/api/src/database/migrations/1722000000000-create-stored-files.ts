import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateStoredFiles1722000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'stored_files',
        columns: [
          {
            name: 'id',
            type: 'char',
            length: '36',
            isPrimary: true,
            isNullable: false,
          },
          {
            name: 'bucket',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'object_key',
            type: 'varchar',
            length: '512',
            isNullable: false,
          },
          {
            name: 'original_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'content_type',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'size_bytes',
            type: 'bigint',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'company_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'updated_at',
            type: 'datetime',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
          {
            name: 'deleted_at',
            type: 'datetime',
            precision: 6,
            isNullable: true,
          },
          {
            name: 'created_by_user_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          {
            name: 'updated_by_user_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
          {
            name: 'deleted_by_user_id',
            type: 'char',
            length: '36',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'stored_files',
      new TableIndex({
        name: 'uq_stored_files_bucket_object_key',
        columnNames: ['bucket', 'object_key'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'stored_files',
      new TableIndex({
        name: 'idx_stored_files_company_id',
        columnNames: ['company_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('stored_files');
  }
}

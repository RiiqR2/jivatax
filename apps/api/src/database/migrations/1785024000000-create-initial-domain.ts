import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumnOptions,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

const auditColumns: TableColumnOptions[] = [
  { name: 'id', type: 'char', length: '36', isPrimary: true },
  { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
  { name: 'updated_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
  { name: 'deleted_at', type: 'datetime', precision: 6, isNullable: true },
  { name: 'created_by_user_id', type: 'char', length: '36', isNullable: true },
  { name: 'updated_by_user_id', type: 'char', length: '36', isNullable: true },
  { name: 'deleted_by_user_id', type: 'char', length: '36', isNullable: true },
];

export class CreateInitialDomain1785024000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(new Table({
      name: 'users',
      columns: [
        ...auditColumns,
        { name: 'email', type: 'varchar', length: '255' },
        { name: 'password_hash', type: 'varchar', length: '255' },
        { name: 'first_name', type: 'varchar', length: '100' },
        { name: 'last_name', type: 'varchar', length: '100' },
        { name: 'status', type: 'enum', enum: ['active', 'inactive', 'blocked'], default: "'active'" },
        { name: 'last_login_at', type: 'datetime', precision: 6, isNullable: true },
      ],
      indices: [new TableIndex({ name: 'uq_users_email', columnNames: ['email'], isUnique: true })],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'organizations',
      columns: [
        ...auditColumns,
        { name: 'name', type: 'varchar', length: '200' },
        { name: 'slug', type: 'varchar', length: '150' },
        { name: 'status', type: 'enum', enum: ['active', 'inactive'], default: "'active'" },
      ],
      indices: [new TableIndex({ name: 'uq_organizations_slug', columnNames: ['slug'], isUnique: true })],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'organization_members',
      columns: [
        ...auditColumns,
        { name: 'organization_id', type: 'char', length: '36' },
        { name: 'user_id', type: 'char', length: '36' },
        { name: 'role', type: 'enum', enum: ['owner', 'admin', 'accountant', 'auditor', 'viewer'] },
        { name: 'status', type: 'enum', enum: ['invited', 'active', 'suspended'], default: "'invited'" },
        { name: 'joined_at', type: 'datetime', precision: 6, isNullable: true },
      ],
      indices: [
        new TableIndex({ name: 'uq_organization_members_organization_id_user_id', columnNames: ['organization_id', 'user_id'], isUnique: true }),
        new TableIndex({ name: 'idx_organization_members_organization_id', columnNames: ['organization_id'] }),
        new TableIndex({ name: 'idx_organization_members_user_id', columnNames: ['user_id'] }),
      ],
      foreignKeys: [
        new TableForeignKey({ name: 'fk_organization_members_organization_id', columnNames: ['organization_id'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
        new TableForeignKey({ name: 'fk_organization_members_user_id', columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'RESTRICT' }),
      ],
    }), true);

    await queryRunner.createTable(new Table({
      name: 'companies',
      columns: [
        ...auditColumns,
        { name: 'organization_id', type: 'char', length: '36' },
        { name: 'rut', type: 'varchar', length: '12' },
        { name: 'legal_name', type: 'varchar', length: '255' },
        { name: 'trade_name', type: 'varchar', length: '255', isNullable: true },
        { name: 'business_activity', type: 'varchar', length: '255', isNullable: true },
        { name: 'status', type: 'enum', enum: ['active', 'inactive'], default: "'active'" },
      ],
      indices: [
        new TableIndex({ name: 'uq_companies_organization_id_rut', columnNames: ['organization_id', 'rut'], isUnique: true }),
        new TableIndex({ name: 'idx_companies_organization_id', columnNames: ['organization_id'] }),
      ],
      foreignKeys: [new TableForeignKey({ name: 'fk_companies_organization_id', columnNames: ['organization_id'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'RESTRICT' })],
    }), true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('companies');
    await queryRunner.dropTable('organization_members');
    await queryRunner.dropTable('organizations');
    await queryRunner.dropTable('users');
  }
}

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserAuthSecurity1785026000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn('users', 'password_hash', new TableColumn({ name: 'password_hash', type: 'varchar', length: '255', isNullable: true }));
    await queryRunner.addColumns('users', [
      new TableColumn({ name: 'password_changed_at', type: 'datetime', precision: 6, isNullable: true }),
      new TableColumn({ name: 'failed_login_attempts', type: 'smallint', unsigned: true, default: 0 }),
      new TableColumn({ name: 'locked_until', type: 'datetime', precision: 6, isNullable: true }),
    ]);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'locked_until');
    await queryRunner.dropColumn('users', 'failed_login_attempts');
    await queryRunner.dropColumn('users', 'password_changed_at');
    await queryRunner.changeColumn('users', 'password_hash', new TableColumn({ name: 'password_hash', type: 'varchar', length: '255' }));
  }
}

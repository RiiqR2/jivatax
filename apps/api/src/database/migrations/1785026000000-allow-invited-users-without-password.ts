import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowInvitedUsersWithoutPassword1785026000000 implements MigrationInterface {
  name = 'AllowInvitedUsersWithoutPassword1785026000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` MODIFY `password_hash` varchar(255) NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `users` SET `password_hash` = CONCAT('disabled:', UUID()) WHERE `password_hash` IS NULL",
    );
    await queryRunner.query(
      'ALTER TABLE `users` MODIFY `password_hash` varchar(255) NOT NULL',
    );
  }
}

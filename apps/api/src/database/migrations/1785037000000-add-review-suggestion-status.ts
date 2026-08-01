import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReviewSuggestionStatus1785037000000 implements MigrationInterface {
  name = "AddReviewSuggestionStatus1785037000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE company_account_suggestions MODIFY status enum('active','review','accepted','rejected','superseded') NOT NULL DEFAULT 'active'`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE company_account_suggestions SET status = 'superseded' WHERE status = 'review'`,
    );
    await queryRunner.query(
      `ALTER TABLE company_account_suggestions MODIFY status enum('active','accepted','rejected','superseded') NOT NULL DEFAULT 'active'`,
    );
  }
}

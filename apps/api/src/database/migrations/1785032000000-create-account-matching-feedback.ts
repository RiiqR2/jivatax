import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAccountMatchingFeedback1785032000000 implements MigrationInterface {
  name = "CreateAccountMatchingFeedback1785032000000";
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE account_matching_feedback (
      id char(36) NOT NULL, company_id char(36) NOT NULL, tax_period_id char(36) NULL,
      normalized_name varchar(500) NOT NULL, sii_account_id char(36) NOT NULL,
      original_score decimal(8,2) NULL, candidate_position smallint unsigned NULL,
      algorithm varchar(50) NOT NULL, accepted tinyint(1) NOT NULL, corrected tinyint(1) NOT NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), PRIMARY KEY (id),
      KEY idx_matching_feedback_alias (normalized_name, accepted),
      CONSTRAINT fk_matching_feedback_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
      CONSTRAINT fk_matching_feedback_period FOREIGN KEY (tax_period_id) REFERENCES tax_periods(id) ON DELETE RESTRICT,
      CONSTRAINT fk_matching_feedback_sii FOREIGN KEY (sii_account_id) REFERENCES sii_accounts(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS account_matching_feedback");
  }
}

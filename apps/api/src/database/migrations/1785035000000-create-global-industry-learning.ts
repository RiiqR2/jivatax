import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGlobalIndustryLearning1785035000000 implements MigrationInterface {
  name = "CreateGlobalIndustryLearning1785035000000";
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE industries (id char(36) NOT NULL, name varchar(255) NOT NULL, normalized_name varchar(255) NOT NULL, created_by_user_id char(36) NOT NULL, is_active tinyint NOT NULL DEFAULT 1, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL, UNIQUE INDEX uq_industries_normalized_name (normalized_name), PRIMARY KEY (id), CONSTRAINT fk_industries_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT)`,
    );
    await q.query(
      `ALTER TABLE companies ADD industry_id char(36) NULL, ADD INDEX idx_companies_industry_id (industry_id), ADD CONSTRAINT fk_companies_industry_id FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE RESTRICT`,
    );
    await q.query(
      `CREATE TABLE account_matching_confirmations (id char(36) NOT NULL, company_id char(36) NULL, industry_id char(36) NULL, company_account_id char(36) NULL, internal_account_code varchar(255) NULL, original_name varchar(500) NOT NULL, normalized_name varchar(500) NOT NULL, normalized_name_hash char(64) NOT NULL, sii_account_id char(36) NOT NULL, source enum('user','expert','import') NOT NULL, confirmed_by_user_id char(36) NULL, confirmed_at datetime(6) NOT NULL, invalidated_at datetime(6) NULL, invalidated_by_user_id char(36) NULL, invalidation_reason varchar(500) NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL, INDEX idx_confirmations_learning (normalized_name_hash, sii_account_id, invalidated_at), PRIMARY KEY (id), CONSTRAINT fk_confirmations_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT, CONSTRAINT fk_confirmations_industry FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE RESTRICT, CONSTRAINT fk_confirmations_company_account FOREIGN KEY (company_account_id) REFERENCES company_accounts(id) ON DELETE RESTRICT, CONSTRAINT fk_confirmations_sii FOREIGN KEY (sii_account_id) REFERENCES sii_accounts(id) ON DELETE RESTRICT, CONSTRAINT fk_confirmations_confirmed_user FOREIGN KEY (confirmed_by_user_id) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT fk_confirmations_invalidated_user FOREIGN KEY (invalidated_by_user_id) REFERENCES users(id) ON DELETE RESTRICT)`,
    );
    await q.query(
      `RENAME TABLE account_matching_learning TO account_matching_learning_legacy`,
    );
    await q.query(
      `CREATE TABLE account_matching_learning (id char(36) NOT NULL, normalized_name varchar(500) NOT NULL, normalized_name_hash char(64) NOT NULL, sii_account_id char(36) NOT NULL, confirmation_count int unsigned NOT NULL, distinct_company_count int unsigned NOT NULL, agreement_rate decimal(8,6) NOT NULL, confidence decimal(8,6) NOT NULL, last_confirmed_at datetime(6) NOT NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL, UNIQUE INDEX uq_account_matching_learning_global (normalized_name_hash, sii_account_id), PRIMARY KEY (id), CONSTRAINT fk_learning_sii FOREIGN KEY (sii_account_id) REFERENCES sii_accounts(id) ON DELETE RESTRICT)`,
    );
    await q.query(
      `CREATE TABLE account_matching_learning_industries (id char(36) NOT NULL, learning_id char(36) NOT NULL, industry_id char(36) NOT NULL, confirmation_count int unsigned NOT NULL, distinct_company_count int unsigned NOT NULL, agreement_rate decimal(8,6) NOT NULL, confidence decimal(8,6) NOT NULL, last_confirmed_at datetime(6) NOT NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL, UNIQUE INDEX uq_learning_industry (learning_id, industry_id), PRIMARY KEY (id), CONSTRAINT fk_learning_industries_learning FOREIGN KEY (learning_id) REFERENCES account_matching_learning(id) ON DELETE RESTRICT, CONSTRAINT fk_learning_industries_industry FOREIGN KEY (industry_id) REFERENCES industries(id) ON DELETE RESTRICT)`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE account_matching_learning_industries`);
    await q.query(`DROP TABLE account_matching_learning`);
    await q.query(
      `RENAME TABLE account_matching_learning_legacy TO account_matching_learning`,
    );
    await q.query(`DROP TABLE account_matching_confirmations`);
    await q.query(
      `ALTER TABLE companies DROP FOREIGN KEY fk_companies_industry_id, DROP INDEX idx_companies_industry_id, DROP COLUMN industry_id`,
    );
    await q.query(`DROP TABLE industries`);
  }
}

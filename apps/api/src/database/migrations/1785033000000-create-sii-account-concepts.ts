import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSiiAccountConcepts1785033000000 implements MigrationInterface {
  name = "CreateSiiAccountConcepts1785033000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sii_account_concepts (
        id char(36) NOT NULL,
        sii_account_id char(36) NOT NULL,
        concept varchar(255) NOT NULL,
        normalized_concept varchar(255) NOT NULL,
        concept_type enum('economic_concept','accounting_family','statement_section','balance_nature','temporal_classification','contra_account_indicator','tax_concept','industry_concept') NOT NULL,
        weight decimal(7,2) NOT NULL,
        source varchar(100) NOT NULL,
        active tinyint(1) NOT NULL DEFAULT 1,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_sii_account_concepts_identity (sii_account_id, normalized_concept, concept_type, source),
        KEY idx_sii_account_concepts_account (sii_account_id),
        KEY idx_sii_account_concepts_normalized (normalized_concept),
        KEY idx_sii_account_concepts_type (concept_type),
        KEY idx_sii_account_concepts_active (active),
        CONSTRAINT fk_sii_account_concepts_account FOREIGN KEY (sii_account_id) REFERENCES sii_accounts(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS sii_account_concepts");
  }
}

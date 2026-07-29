import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSiiAccountMatching1785031000000
  implements MigrationInterface
{
  name = "CreateSiiAccountMatching1785031000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sii_account_terms (
        id char(36) NOT NULL,
        sii_account_id char(36) NOT NULL,
        company_id char(36) NULL,
        term varchar(500) NOT NULL,
        normalized_term varchar(500) NOT NULL,
        scope enum('global', 'company') NOT NULL,
        company_scope char(36)
          GENERATED ALWAYS AS (IFNULL(company_id, 'GLOBAL')) STORED,
        type enum(
          'official_name',
          'alias',
          'abbreviation',
          'manual_term',
          'erp_term',
          'industry_term',
          'negative_term'
        ) NOT NULL,
        weight decimal(7, 2) NOT NULL,
        source varchar(100) NOT NULL,
        active tinyint(1) NOT NULL DEFAULT 1,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL
          DEFAULT CURRENT_TIMESTAMP(6)
          ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_sii_terms_identity (
          sii_account_id,
          normalized_term,
          type,
          source,
          scope,
          company_scope
        ),
        KEY idx_sii_terms_account_scope (
          sii_account_id,
          company_id,
          active
        ),
        KEY idx_sii_terms_normalized (
          normalized_term
        ),
        CONSTRAINT fk_sii_terms_account
          FOREIGN KEY (sii_account_id)
          REFERENCES sii_accounts(id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_sii_terms_company
          FOREIGN KEY (company_id)
          REFERENCES companies(id)
          ON DELETE RESTRICT
      )
      ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE company_account_suggestions (
        id char(36) NOT NULL,
        company_account_id char(36) NOT NULL,
        sii_account_id char(36) NOT NULL,
        suggestion_rank smallint unsigned NOT NULL,
        score decimal(8, 2) NOT NULL,
        confidence decimal(5, 4) NOT NULL,
        algorithm_version varchar(50) NOT NULL,
        reasons json NOT NULL,
        status enum(
          'active',
          'accepted',
          'rejected',
          'superseded'
        ) NOT NULL DEFAULT 'active',
        generated_at datetime(6) NOT NULL,
        reviewed_by_user_id char(36) NULL,
        reviewed_at datetime(6) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL
          DEFAULT CURRENT_TIMESTAMP(6)
          ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        KEY idx_suggestions_account_status (
          company_account_id,
          status,
          suggestion_rank
        ),
        CONSTRAINT fk_suggestions_company_account
          FOREIGN KEY (company_account_id)
          REFERENCES company_accounts(id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_suggestions_sii_account
          FOREIGN KEY (sii_account_id)
          REFERENCES sii_accounts(id)
          ON DELETE RESTRICT,
        CONSTRAINT fk_suggestions_reviewer
          FOREIGN KEY (reviewed_by_user_id)
          REFERENCES users(id)
          ON DELETE RESTRICT
      )
      ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS company_account_suggestions
    `);

    await queryRunner.query(`
      DROP TABLE IF EXISTS sii_account_terms
    `);
  }
}
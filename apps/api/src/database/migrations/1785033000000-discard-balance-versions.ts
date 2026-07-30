import type { MigrationInterface, QueryRunner } from "typeorm";

export class DiscardBalanceVersions1785033000000 implements MigrationInterface {
  name = "DiscardBalanceVersions1785033000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE tax_documents MODIFY status enum ('uploaded','validating','valid','invalid','processing','processed','superseded','discarded','processing_error') NOT NULL DEFAULT 'uploaded'",
    );
    await queryRunner.query(
      "ALTER TABLE tax_documents ADD discarded_at datetime(6) NULL, ADD discarded_by_user_id char(36) NULL, ADD discard_reason varchar(1000) NULL, ADD status_before_discard varchar(40) NULL, ADD CONSTRAINT fk_tax_documents_discard_user FOREIGN KEY (discarded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT",
    );
    await queryRunner.query(
      "ALTER TABLE tax_period_company_accounts ADD discarded_at datetime(6) NULL, ADD discarded_by_document_id char(36) NULL, ADD INDEX idx_period_accounts_operational (company_id, tax_period_id, discarded_at), ADD CONSTRAINT fk_period_accounts_discard_document FOREIGN KEY (discarded_by_document_id) REFERENCES tax_documents(id) ON DELETE RESTRICT",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE tax_period_company_accounts DROP FOREIGN KEY fk_period_accounts_discard_document, DROP INDEX idx_period_accounts_operational, DROP COLUMN discarded_by_document_id, DROP COLUMN discarded_at",
    );
    await queryRunner.query(
      "ALTER TABLE tax_documents DROP FOREIGN KEY fk_tax_documents_discard_user, DROP COLUMN status_before_discard, DROP COLUMN discard_reason, DROP COLUMN discarded_by_user_id, DROP COLUMN discarded_at",
    );
    await queryRunner.query(
      "ALTER TABLE tax_documents MODIFY status enum ('uploaded','validating','valid','invalid','processing','processed','superseded','processing_error') NOT NULL DEFAULT 'uploaded'",
    );
  }
}

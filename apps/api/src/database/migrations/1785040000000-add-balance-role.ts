import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBalanceRole1785040000000 implements MigrationInterface {
  name = "AddBalanceRole1785040000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE tax_documents DROP INDEX uq_tax_documents_version, ADD balance_role enum('opening','closing') NULL AFTER document_type, ADD balance_role_key varchar(20) GENERATED ALWAYS AS (COALESCE(balance_role,'unclassified')) STORED AFTER balance_role, ADD balance_role_classified_at datetime(6) NULL AFTER balance_role_key, ADD balance_role_classified_by_user_id char(36) NULL AFTER balance_role_classified_at, ADD UNIQUE KEY uq_tax_documents_version (company_id,tax_period_id,document_type,balance_role_key,version_number), ADD KEY idx_tax_documents_balance_role (company_id,tax_period_id,document_type,balance_role,status), ADD CONSTRAINT fk_tax_documents_balance_classifier FOREIGN KEY (balance_role_classified_by_user_id) REFERENCES users(id) ON DELETE RESTRICT",
    );
    await queryRunner.query(
      "ALTER TABLE balance_entries ADD company_account_id char(36) NULL AFTER tax_period_id, ADD KEY idx_balance_entries_company_account (company_account_id), ADD CONSTRAINT fk_balance_entries_company_account FOREIGN KEY (company_account_id) REFERENCES company_accounts(id) ON DELETE SET NULL",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const collisions = (await queryRunner.query(
      `SELECT company_id, tax_period_id, document_type, version_number, COUNT(*) total
       FROM tax_documents GROUP BY company_id, tax_period_id, document_type, version_number HAVING COUNT(*) > 1 LIMIT 1`,
    )) as Array<Record<string, unknown>>;
    if (collisions.length > 0)
      throw new Error(
        "No se puede revertir balance_role: existen versiones opening/closing con el mismo número. Clasifique y resuelva las colisiones antes del rollback.",
      );
    await queryRunner.query(
      "ALTER TABLE balance_entries DROP FOREIGN KEY fk_balance_entries_company_account, DROP INDEX idx_balance_entries_company_account, DROP company_account_id",
    );
    await queryRunner.query(
      "ALTER TABLE tax_documents DROP FOREIGN KEY fk_tax_documents_balance_classifier, DROP INDEX idx_tax_documents_balance_role, DROP INDEX uq_tax_documents_version, DROP balance_role_classified_by_user_id, DROP balance_role_classified_at, DROP balance_role_key, DROP balance_role, ADD UNIQUE KEY uq_tax_documents_version (company_id,tax_period_id,document_type,version_number)",
    );
  }
}

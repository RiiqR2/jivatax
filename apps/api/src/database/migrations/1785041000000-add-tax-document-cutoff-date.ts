import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaxDocumentCutoffDate1785041000000 implements MigrationInterface {
  name = "AddTaxDocumentCutoffDate1785041000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE tax_documents ADD cutoff_date date NULL AFTER uploaded_at, ADD KEY idx_tax_documents_cutoff (company_id,tax_period_id,document_type,balance_role,cutoff_date)",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE tax_documents DROP INDEX idx_tax_documents_cutoff, DROP cutoff_date",
    );
  }
}

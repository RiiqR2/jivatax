import { MigrationInterface, QueryRunner } from "typeorm";

export class ExtendBalanceReportedSummaries1785041000000 implements MigrationInterface {
  name = "ExtendBalanceReportedSummaries1785041000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE balance_source_rows
      MODIFY row_type enum('account','subtotal','result','total','reported_summary','note','empty','unknown') NOT NULL`);
    await queryRunner.query(`ALTER TABLE balance_reported_summaries
      MODIFY summary_type varchar(30) NOT NULL,
      ADD company_id char(36) NULL AFTER source_row_id,
      ADD tax_period_id char(36) NULL AFTER company_id,
      ADD tax_document_id char(36) NULL AFTER tax_period_id,
      ADD balance_role varchar(20) NULL AFTER tax_document_id,
      ADD source_row_number int unsigned NULL AFTER balance_role,
      ADD normalized_label varchar(255) NULL AFTER label,
      ADD raw_data json NULL AFTER reported_gains,
      ADD KEY idx_balance_summaries_document(tax_document_id),
      ADD CONSTRAINT fk_balance_summaries_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE RESTRICT,
      ADD CONSTRAINT fk_balance_summaries_period FOREIGN KEY(tax_period_id) REFERENCES tax_periods(id) ON DELETE RESTRICT,
      ADD CONSTRAINT fk_balance_summaries_document FOREIGN KEY(tax_document_id) REFERENCES tax_documents(id) ON DELETE RESTRICT`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const incompatible = (await queryRunner.query(
      "SELECT id FROM balance_reported_summaries WHERE summary_type NOT IN ('subtotal','result','total') LIMIT 1",
    )) as unknown[];
    if (incompatible.length > 0)
      throw new Error(
        "No se puede revertir: existen resúmenes genéricos que no caben en el enum histórico.",
      );
    await queryRunner.query(`ALTER TABLE balance_reported_summaries
      DROP FOREIGN KEY fk_balance_summaries_document,
      DROP FOREIGN KEY fk_balance_summaries_period,
      DROP FOREIGN KEY fk_balance_summaries_company,
      DROP INDEX idx_balance_summaries_document,
      DROP raw_data, DROP normalized_label, DROP source_row_number,
      DROP balance_role, DROP tax_document_id, DROP tax_period_id, DROP company_id,
      MODIFY summary_type enum('subtotal','result','total') NOT NULL`);
    await queryRunner.query(`ALTER TABLE balance_source_rows
      MODIFY row_type enum('account','subtotal','result','total','note','empty','unknown') NOT NULL`);
  }
}

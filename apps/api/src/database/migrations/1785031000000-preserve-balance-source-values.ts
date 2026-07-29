import { MigrationInterface, QueryRunner } from "typeorm";

export class PreserveBalanceSourceValues1785031000000 implements MigrationInterface {
  name = "PreserveBalanceSourceValues1785031000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE balance_source_rows (
      id char(36) NOT NULL,
      balance_import_id char(36) NOT NULL,
      company_id char(36) NOT NULL,
      tax_period_id char(36) NOT NULL,
      source_row_number int unsigned NOT NULL,
      sheet_name varchar(255) NOT NULL,
      row_type enum('account','subtotal','result','total','note','empty','unknown') NOT NULL,
      account_code_raw json NULL,
      account_name_raw json NULL,
      debits_raw json NULL,
      credits_raw json NULL,
      debit_balance_raw json NULL,
      credit_balance_raw json NULL,
      assets_raw json NULL,
      liabilities_raw json NULL,
      losses_raw json NULL,
      gains_raw json NULL,
      raw_data json NOT NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY(id),
      UNIQUE KEY uq_balance_source_import_row(balance_import_id, source_row_number),
      KEY idx_balance_source_company_period(company_id, tax_period_id),
      CONSTRAINT fk_balance_source_import FOREIGN KEY(balance_import_id) REFERENCES balance_imports(id) ON DELETE RESTRICT,
      CONSTRAINT fk_balance_source_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE RESTRICT,
      CONSTRAINT fk_balance_source_period FOREIGN KEY(tax_period_id) REFERENCES tax_periods(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB`);

    await queryRunner.query(`CREATE TABLE balance_reported_summaries (
      id char(36) NOT NULL,
      balance_import_id char(36) NOT NULL,
      source_row_id char(36) NOT NULL,
      summary_type enum('subtotal','result','total') NOT NULL,
      label varchar(255) NOT NULL,
      reported_debits decimal(24,4) NULL,
      reported_credits decimal(24,4) NULL,
      reported_debit_balance decimal(24,4) NULL,
      reported_credit_balance decimal(24,4) NULL,
      reported_assets decimal(24,4) NULL,
      reported_liabilities decimal(24,4) NULL,
      reported_losses decimal(24,4) NULL,
      reported_gains decimal(24,4) NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY(id),
      KEY idx_balance_summaries_import(balance_import_id),
      CONSTRAINT fk_balance_summaries_import FOREIGN KEY(balance_import_id) REFERENCES balance_imports(id) ON DELETE RESTRICT,
      CONSTRAINT fk_balance_summaries_source FOREIGN KEY(source_row_id) REFERENCES balance_source_rows(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB`);

    await queryRunner.query(`ALTER TABLE balance_entries
      CHANGE debits reported_debits decimal(24,4) NULL,
      CHANGE credits reported_credits decimal(24,4) NULL,
      CHANGE debit_balance reported_debit_balance decimal(24,4) NULL,
      CHANGE credit_balance reported_credit_balance decimal(24,4) NULL,
      CHANGE assets reported_assets decimal(24,4) NULL,
      CHANGE liabilities reported_liabilities decimal(24,4) NULL,
      CHANGE losses reported_losses decimal(24,4) NULL,
      CHANGE gains reported_gains decimal(24,4) NULL,
      ADD source_row_id char(36) NULL AFTER tax_period_id,
      ADD effective_debits decimal(24,4) NOT NULL DEFAULT 0,
      ADD effective_credits decimal(24,4) NOT NULL DEFAULT 0,
      ADD effective_debit_balance decimal(24,4) NOT NULL DEFAULT 0,
      ADD effective_credit_balance decimal(24,4) NOT NULL DEFAULT 0,
      ADD effective_assets decimal(24,4) NOT NULL DEFAULT 0,
      ADD effective_liabilities decimal(24,4) NOT NULL DEFAULT 0,
      ADD effective_losses decimal(24,4) NOT NULL DEFAULT 0,
      ADD effective_gains decimal(24,4) NOT NULL DEFAULT 0,
      ADD calculated_debit_balance decimal(24,4) NULL,
      ADD calculated_credit_balance decimal(24,4) NULL,
      ADD debits_was_blank tinyint NOT NULL DEFAULT 0,
      ADD credits_was_blank tinyint NOT NULL DEFAULT 0,
      ADD debit_balance_was_blank tinyint NOT NULL DEFAULT 0,
      ADD credit_balance_was_blank tinyint NOT NULL DEFAULT 0,
      ADD assets_was_blank tinyint NOT NULL DEFAULT 0,
      ADD liabilities_was_blank tinyint NOT NULL DEFAULT 0,
      ADD losses_was_blank tinyint NOT NULL DEFAULT 0,
      ADD gains_was_blank tinyint NOT NULL DEFAULT 0,
      ADD CONSTRAINT fk_balance_entries_source FOREIGN KEY(source_row_id) REFERENCES balance_source_rows(id) ON DELETE SET NULL`);
    await queryRunner.query(`UPDATE balance_entries SET
      effective_debits = COALESCE(reported_debits, 0),
      effective_credits = COALESCE(reported_credits, 0),
      effective_debit_balance = COALESCE(reported_debit_balance, 0),
      effective_credit_balance = COALESCE(reported_credit_balance, 0),
      effective_assets = COALESCE(reported_assets, 0),
      effective_liabilities = COALESCE(reported_liabilities, 0),
      effective_losses = COALESCE(reported_losses, 0),
      effective_gains = COALESCE(reported_gains, 0)`);

    await queryRunner.query(`ALTER TABLE tax_period_company_accounts
      MODIFY debit_amount decimal(24,4) NULL,
      MODIFY credit_amount decimal(24,4) NULL,
      MODIFY debit_balance decimal(24,4) NULL,
      MODIFY credit_balance decimal(24,4) NULL,
      MODIFY asset_amount decimal(24,4) NULL,
      MODIFY liability_amount decimal(24,4) NULL,
      MODIFY loss_amount decimal(24,4) NULL,
      MODIFY gain_amount decimal(24,4) NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE balance_entries SET
      reported_debits = COALESCE(reported_debits, 0),
      reported_credits = COALESCE(reported_credits, 0),
      reported_debit_balance = COALESCE(reported_debit_balance, 0),
      reported_credit_balance = COALESCE(reported_credit_balance, 0),
      reported_assets = COALESCE(reported_assets, 0),
      reported_liabilities = COALESCE(reported_liabilities, 0),
      reported_losses = COALESCE(reported_losses, 0),
      reported_gains = COALESCE(reported_gains, 0)`);
    await queryRunner.query(`UPDATE tax_period_company_accounts SET
      debit_amount = COALESCE(debit_amount, 0),
      credit_amount = COALESCE(credit_amount, 0),
      debit_balance = COALESCE(debit_balance, 0),
      credit_balance = COALESCE(credit_balance, 0),
      asset_amount = COALESCE(asset_amount, 0),
      liability_amount = COALESCE(liability_amount, 0),
      loss_amount = COALESCE(loss_amount, 0),
      gain_amount = COALESCE(gain_amount, 0)`);
    await queryRunner.query(`ALTER TABLE balance_entries
      DROP FOREIGN KEY fk_balance_entries_source,
      DROP source_row_id,
      DROP effective_debits,
      DROP effective_credits,
      DROP effective_debit_balance,
      DROP effective_credit_balance,
      DROP effective_assets,
      DROP effective_liabilities,
      DROP effective_losses,
      DROP effective_gains,
      DROP calculated_debit_balance,
      DROP calculated_credit_balance,
      DROP debits_was_blank,
      DROP credits_was_blank,
      DROP debit_balance_was_blank,
      DROP credit_balance_was_blank,
      DROP assets_was_blank,
      DROP liabilities_was_blank,
      DROP losses_was_blank,
      DROP gains_was_blank,
      CHANGE reported_debits debits decimal(24,4) NOT NULL,
      CHANGE reported_credits credits decimal(24,4) NOT NULL,
      CHANGE reported_debit_balance debit_balance decimal(24,4) NOT NULL,
      CHANGE reported_credit_balance credit_balance decimal(24,4) NOT NULL,
      CHANGE reported_assets assets decimal(24,4) NOT NULL,
      CHANGE reported_liabilities liabilities decimal(24,4) NOT NULL,
      CHANGE reported_losses losses decimal(24,4) NOT NULL,
      CHANGE reported_gains gains decimal(24,4) NOT NULL`);
    await queryRunner.query(`ALTER TABLE tax_period_company_accounts
      MODIFY debit_amount decimal(24,4) NOT NULL,
      MODIFY credit_amount decimal(24,4) NOT NULL,
      MODIFY debit_balance decimal(24,4) NOT NULL,
      MODIFY credit_balance decimal(24,4) NOT NULL,
      MODIFY asset_amount decimal(24,4) NOT NULL,
      MODIFY liability_amount decimal(24,4) NOT NULL,
      MODIFY loss_amount decimal(24,4) NOT NULL,
      MODIFY gain_amount decimal(24,4) NOT NULL`);
    await queryRunner.query("DROP TABLE balance_reported_summaries");
    await queryRunner.query("DROP TABLE balance_source_rows");
  }
}

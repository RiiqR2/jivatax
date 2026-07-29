import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAccountingImportCore1785030000000 implements MigrationInterface {
  name = "CreateAccountingImportCore1785030000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE tax_periods (
      id char(36) NOT NULL, company_id char(36) NOT NULL, commercial_year smallint NOT NULL,
      tax_year smallint NOT NULL, start_date date NOT NULL, end_date date NOT NULL,
      status enum('open','processing','reviewed','closed') NOT NULL DEFAULT 'open',
      tax_regime varchar(100) NULL, currency varchar(3) NOT NULL DEFAULT 'CLP', is_active tinyint NOT NULL DEFAULT 1,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL,
      PRIMARY KEY (id), UNIQUE KEY uq_tax_periods_company_tax_year (company_id, tax_year),
      CONSTRAINT fk_tax_periods_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE tax_documents (
      id char(36) NOT NULL, company_id char(36) NOT NULL, tax_period_id char(36) NOT NULL, stored_file_id char(36) NOT NULL,
      document_type enum('balance','general_ledger','journal') NOT NULL,
      status enum('uploaded','validating','valid','invalid','processing','processed','superseded','processing_error') NOT NULL DEFAULT 'uploaded',
      version_number int unsigned NOT NULL, replaces_document_id char(36) NULL, uploaded_by_user_id char(36) NOT NULL,
      uploaded_at datetime(6) NOT NULL, validated_at datetime(6) NULL, processed_at datetime(6) NULL,
      error_summary text NULL, warning_summary text NULL, metadata json NULL,
      created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL,
      PRIMARY KEY (id), UNIQUE KEY uq_tax_documents_version (company_id,tax_period_id,document_type,version_number),
      KEY idx_tax_documents_period_type (tax_period_id,document_type),
      CONSTRAINT fk_tax_documents_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT,
      CONSTRAINT fk_tax_documents_period FOREIGN KEY (tax_period_id) REFERENCES tax_periods(id) ON DELETE RESTRICT,
      CONSTRAINT fk_tax_documents_file FOREIGN KEY (stored_file_id) REFERENCES stored_files(id) ON DELETE RESTRICT,
      CONSTRAINT fk_tax_documents_replaces FOREIGN KEY (replaces_document_id) REFERENCES tax_documents(id) ON DELETE SET NULL,
      CONSTRAINT fk_tax_documents_user FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB`);
    await this.createImportTables(queryRunner);
    await queryRunner.query(`ALTER TABLE company_accounts
      MODIFY company_account_plan_version_id char(36) NULL,
      ADD first_seen_tax_period_id char(36) NULL, ADD last_seen_tax_period_id char(36) NULL,
      ADD first_seen_at datetime(6) NULL, ADD last_seen_at datetime(6) NULL,
      ADD UNIQUE KEY uq_company_accounts_company_code (company_id, internal_code),
      ADD CONSTRAINT fk_company_accounts_first_period FOREIGN KEY (first_seen_tax_period_id) REFERENCES tax_periods(id) ON DELETE SET NULL,
      ADD CONSTRAINT fk_company_accounts_last_period FOREIGN KEY (last_seen_tax_period_id) REFERENCES tax_periods(id) ON DELETE SET NULL`);
    await queryRunner.query(
      "ALTER TABLE company_account_mappings MODIFY status enum('pending','suggested','confirmed','rejected','unmapped') NOT NULL",
    );
    await queryRunner.query(`CREATE TABLE company_account_mapping_history (
      id char(36) NOT NULL, company_account_id char(36) NOT NULL, previous_sii_account_id char(36) NULL,
      new_sii_account_id char(36) NULL, previous_status varchar(30) NULL, new_status varchar(30) NOT NULL,
      changed_by_user_id char(36) NOT NULL, reason text NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      PRIMARY KEY(id), KEY idx_mapping_history_account(company_account_id),
      CONSTRAINT fk_mapping_history_account FOREIGN KEY(company_account_id) REFERENCES company_accounts(id) ON DELETE RESTRICT,
      CONSTRAINT fk_mapping_history_previous_sii FOREIGN KEY(previous_sii_account_id) REFERENCES sii_accounts(id) ON DELETE RESTRICT,
      CONSTRAINT fk_mapping_history_new_sii FOREIGN KEY(new_sii_account_id) REFERENCES sii_accounts(id) ON DELETE RESTRICT,
      CONSTRAINT fk_mapping_history_user FOREIGN KEY(changed_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB`);
  }

  private async createImportTables(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      "balance_imports",
      "general_ledger_imports",
      "journal_imports",
    ]) {
      await queryRunner.query(`CREATE TABLE ${table} (
        id char(36) NOT NULL, tax_document_id char(36) NOT NULL, company_id char(36) NOT NULL, tax_period_id char(36) NOT NULL,
        rows_read int unsigned NOT NULL, valid_rows int unsigned NOT NULL, ignored_rows int unsigned NOT NULL,
        total_debit decimal(24,4) NOT NULL DEFAULT 0, total_credit decimal(24,4) NOT NULL DEFAULT 0,
        validation_report json NOT NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY(id), UNIQUE KEY uq_${table}_document(tax_document_id), KEY idx_${table}_company_period(company_id,tax_period_id),
        CONSTRAINT fk_${table}_document FOREIGN KEY(tax_document_id) REFERENCES tax_documents(id) ON DELETE RESTRICT,
        CONSTRAINT fk_${table}_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE RESTRICT,
        CONSTRAINT fk_${table}_period FOREIGN KEY(tax_period_id) REFERENCES tax_periods(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB`);
    }
    await queryRunner.query(`ALTER TABLE balance_imports
      ADD sheet_name varchar(255) NULL, ADD header_row_number int unsigned NULL,
      ADD total_debit_balance decimal(24,4) NOT NULL DEFAULT 0, ADD total_credit_balance decimal(24,4) NOT NULL DEFAULT 0,
      ADD total_assets decimal(24,4) NOT NULL DEFAULT 0, ADD total_liabilities decimal(24,4) NOT NULL DEFAULT 0,
      ADD total_losses decimal(24,4) NOT NULL DEFAULT 0, ADD total_gains decimal(24,4) NOT NULL DEFAULT 0,
      ADD is_debit_credit_balanced tinyint NOT NULL DEFAULT 0, ADD is_equity_balanced tinyint NOT NULL DEFAULT 0`);
    await queryRunner.query(`ALTER TABLE journal_imports ADD vouchers_read int unsigned NOT NULL DEFAULT 0,
      ADD balanced_vouchers int unsigned NOT NULL DEFAULT 0, ADD unbalanced_vouchers int unsigned NOT NULL DEFAULT 0`);
    await queryRunner.query(`CREATE TABLE balance_entries (
      id char(36) NOT NULL, balance_import_id char(36) NOT NULL, company_id char(36) NOT NULL, tax_period_id char(36) NOT NULL,
      account_code varchar(100) NOT NULL, account_name varchar(255) NOT NULL,
      debits decimal(24,4) NOT NULL, credits decimal(24,4) NOT NULL, debit_balance decimal(24,4) NOT NULL, credit_balance decimal(24,4) NOT NULL,
      assets decimal(24,4) NOT NULL, liabilities decimal(24,4) NOT NULL, losses decimal(24,4) NOT NULL, gains decimal(24,4) NOT NULL,
      source_row_number int unsigned NOT NULL, raw_data json NOT NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      PRIMARY KEY(id), KEY idx_balance_entries_import(balance_import_id), KEY idx_balance_entries_company_period_code(company_id,tax_period_id,account_code),
      CONSTRAINT fk_balance_entries_import FOREIGN KEY(balance_import_id) REFERENCES balance_imports(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE tax_period_company_accounts (
      id char(36) NOT NULL, company_id char(36) NOT NULL, tax_period_id char(36) NOT NULL, company_account_id char(36) NOT NULL,
      source_document_id char(36) NOT NULL, balance_entry_id char(36) NULL, account_code_snapshot varchar(100) NOT NULL, account_name_snapshot varchar(255) NOT NULL,
      debit_amount decimal(24,4) NOT NULL, credit_amount decimal(24,4) NOT NULL, debit_balance decimal(24,4) NOT NULL, credit_balance decimal(24,4) NOT NULL,
      asset_amount decimal(24,4) NOT NULL, liability_amount decimal(24,4) NOT NULL, loss_amount decimal(24,4) NOT NULL, gain_amount decimal(24,4) NOT NULL,
      first_seen_at datetime(6) NOT NULL, last_seen_at datetime(6) NOT NULL, created_at datetime(6) NOT NULL, updated_at datetime(6) NOT NULL,
      PRIMARY KEY(id), UNIQUE KEY uq_period_company_account(tax_period_id,company_account_id),
      CONSTRAINT fk_period_accounts_period FOREIGN KEY(tax_period_id) REFERENCES tax_periods(id) ON DELETE RESTRICT,
      CONSTRAINT fk_period_accounts_account FOREIGN KEY(company_account_id) REFERENCES company_accounts(id) ON DELETE RESTRICT,
      CONSTRAINT fk_period_accounts_document FOREIGN KEY(source_document_id) REFERENCES tax_documents(id) ON DELETE RESTRICT,
      CONSTRAINT fk_period_accounts_entry FOREIGN KEY(balance_entry_id) REFERENCES balance_entries(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`);
    await this.createMovementEntries(queryRunner);
  }

  private async createMovementEntries(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE general_ledger_entries (
      id char(36) NOT NULL, general_ledger_import_id char(36) NOT NULL, company_id char(36) NOT NULL, tax_period_id char(36) NOT NULL, company_account_id char(36) NULL,
      account_code varchar(100) NOT NULL, account_name varchar(255) NOT NULL, transaction_date date NOT NULL, document_type varchar(100) NULL, document_number varchar(100) NULL,
      description text NOT NULL, debit decimal(24,4) NOT NULL, credit decimal(24,4) NOT NULL, debit_balance decimal(24,4) NULL, credit_balance decimal(24,4) NULL,
      cost_center varchar(100) NULL, auxiliary_code varchar(100) NULL, counterparty_rut varchar(20) NULL, voucher_number varchar(100) NULL, currency varchar(3) NULL, exchange_rate decimal(18,6) NULL,
      source_row_number int unsigned NOT NULL, raw_data json NOT NULL, created_at datetime(6) NOT NULL, updated_at datetime(6) NOT NULL,
      PRIMARY KEY(id), KEY idx_ledger_import(general_ledger_import_id), KEY idx_ledger_lookup(company_id,tax_period_id,account_code,transaction_date), KEY idx_ledger_document(document_number), KEY idx_ledger_voucher(voucher_number),
      CONSTRAINT fk_ledger_entries_import FOREIGN KEY(general_ledger_import_id) REFERENCES general_ledger_imports(id) ON DELETE RESTRICT,
      CONSTRAINT fk_ledger_entries_account FOREIGN KEY(company_account_id) REFERENCES company_accounts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE journal_entries (
      id char(36) NOT NULL, journal_import_id char(36) NOT NULL, company_id char(36) NOT NULL, tax_period_id char(36) NOT NULL, company_account_id char(36) NULL,
      transaction_date date NOT NULL, voucher_number varchar(100) NOT NULL, sequence_number int unsigned NOT NULL, account_code varchar(100) NOT NULL, account_name varchar(255) NULL,
      debit decimal(24,4) NOT NULL, credit decimal(24,4) NOT NULL, description text NOT NULL, auxiliary_code varchar(100) NULL, cost_center varchar(100) NULL, ledger_name varchar(100) NULL,
      document_type varchar(100) NULL, document_number varchar(100) NULL, counterparty_rut varchar(20) NULL, counterparty_name varchar(255) NULL,
      document_date date NULL, due_date date NULL, net_amount decimal(24,4) NULL, exempt_amount decimal(24,4) NULL, vat_amount decimal(24,4) NULL, fixed_asset_vat_amount decimal(24,4) NULL,
      additional_tax_code varchar(50) NULL, additional_tax_rate decimal(9,6) NULL, additional_tax_amount decimal(24,4) NULL, currency varchar(3) NULL, exchange_rate decimal(18,6) NULL,
      is_opening_entry tinyint NOT NULL DEFAULT 0, is_fixed_asset tinyint NULL, source_row_number int unsigned NOT NULL, raw_data json NOT NULL, created_at datetime(6) NOT NULL, updated_at datetime(6) NOT NULL,
      PRIMARY KEY(id), UNIQUE KEY uq_journal_sequence(journal_import_id,voucher_number,sequence_number), KEY idx_journal_lookup(company_id,tax_period_id,account_code,transaction_date), KEY idx_journal_document(document_number), KEY idx_journal_rut(counterparty_rut),
      CONSTRAINT fk_journal_entries_import FOREIGN KEY(journal_import_id) REFERENCES journal_imports(id) ON DELETE RESTRICT,
      CONSTRAINT fk_journal_entries_account FOREIGN KEY(company_account_id) REFERENCES company_accounts(id) ON DELETE SET NULL
    ) ENGINE=InnoDB`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      "company_account_mapping_history",
      "journal_entries",
      "general_ledger_entries",
      "tax_period_company_accounts",
      "balance_entries",
      "journal_imports",
      "general_ledger_imports",
      "balance_imports",
    ])
      await queryRunner.query(`DROP TABLE ${table}`);
    await queryRunner.query(
      "ALTER TABLE company_accounts DROP FOREIGN KEY fk_company_accounts_first_period, DROP FOREIGN KEY fk_company_accounts_last_period, DROP INDEX uq_company_accounts_company_code, DROP first_seen_tax_period_id, DROP last_seen_tax_period_id, DROP first_seen_at, DROP last_seen_at, MODIFY company_account_plan_version_id char(36) NOT NULL",
    );
    await queryRunner.query(
      "ALTER TABLE company_account_mappings MODIFY status enum('suggested','confirmed','rejected','unmapped') NOT NULL",
    );
    await queryRunner.query("DROP TABLE tax_documents");
    await queryRunner.query("DROP TABLE tax_periods");
  }
}

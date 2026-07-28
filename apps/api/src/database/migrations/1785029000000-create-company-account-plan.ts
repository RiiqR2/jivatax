import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCompanyAccountPlan1785029000000 implements MigrationInterface {
  name = "CreateCompanyAccountPlan1785029000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `stored_files` MODIFY `category` enum ('balance','journal','ledger','xml','declaration','report','company_account_plan','other') NOT NULL",
    );
    await queryRunner.query(`
      CREATE TABLE \`company_account_plan_versions\` (
        \`id\` char(36) NOT NULL,
        \`company_id\` char(36) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`source_file_name\` varchar(255) NOT NULL,
        \`source_checksum\` varchar(128) NOT NULL,
        \`status\` enum ('draft','processing','ready','failed','archived') NOT NULL DEFAULT 'draft',
        \`imported_at\` datetime(6) NULL,
        \`processed_at\` datetime(6) NULL,
        \`failure_reason\` text NULL,
        \`total_rows\` int unsigned NOT NULL DEFAULT 0,
        \`valid_rows\` int unsigned NOT NULL DEFAULT 0,
        \`invalid_rows\` int unsigned NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        \`created_by_user_id\` char(36) NULL,
        \`updated_by_user_id\` char(36) NULL,
        \`deleted_by_user_id\` char(36) NULL,
        UNIQUE INDEX \`uq_company_account_plan_versions_company_checksum\` (\`company_id\`, \`source_checksum\`),
        INDEX \`idx_company_account_plan_versions_company_id\` (\`company_id\`),
        INDEX \`idx_company_account_plan_versions_status\` (\`status\`),
        INDEX \`idx_company_account_plan_versions_created_at\` (\`created_at\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_company_account_plan_versions_company_id\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`company_accounts\` (
        \`id\` char(36) NOT NULL,
        \`company_account_plan_version_id\` char(36) NOT NULL,
        \`company_id\` char(36) NOT NULL,
        \`internal_code\` varchar(100) NOT NULL,
        \`name\` varchar(255) NOT NULL,
        \`description\` text NULL,
        \`level\` smallint unsigned NULL,
        \`parent_id\` char(36) NULL,
        \`sort_order\` int unsigned NOT NULL,
        \`source_row_number\` int unsigned NOT NULL,
        \`raw_data\` json NULL,
        \`status\` enum ('active','inactive') NOT NULL DEFAULT 'active',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        UNIQUE INDEX \`uq_company_accounts_version_internal_code\` (\`company_account_plan_version_id\`, \`internal_code\`),
        INDEX \`idx_company_accounts_company_id\` (\`company_id\`),
        INDEX \`idx_company_accounts_version_id\` (\`company_account_plan_version_id\`),
        INDEX \`idx_company_accounts_parent_id\` (\`parent_id\`),
        INDEX \`idx_company_accounts_name\` (\`name\`),
        INDEX \`idx_company_accounts_internal_code\` (\`internal_code\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_company_accounts_company_id\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_company_accounts_version_id\` FOREIGN KEY (\`company_account_plan_version_id\`) REFERENCES \`company_account_plan_versions\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_company_accounts_parent_id\` FOREIGN KEY (\`parent_id\`) REFERENCES \`company_accounts\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE \`company_account_mappings\` (
        \`id\` char(36) NOT NULL,
        \`company_account_id\` char(36) NOT NULL,
        \`sii_account_id\` char(36) NULL,
        \`status\` enum ('suggested','confirmed','rejected','unmapped') NOT NULL,
        \`mapping_method\` enum ('manual','exact_code','exact_name','normalized_name','contains_name','automatic') NOT NULL,
        \`confidence\` decimal(5,4) NULL,
        \`notes\` text NULL,
        \`reviewed_by_user_id\` char(36) NULL,
        \`reviewed_at\` datetime(6) NULL,
        \`suggested_at\` datetime(6) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        UNIQUE INDEX \`uq_company_account_mappings_company_account_id\` (\`company_account_id\`),
        INDEX \`idx_company_account_mappings_sii_account_id\` (\`sii_account_id\`),
        INDEX \`idx_company_account_mappings_status\` (\`status\`),
        INDEX \`idx_company_account_mappings_method\` (\`mapping_method\`),
        INDEX \`idx_company_account_mappings_confidence\` (\`confidence\`),
        CONSTRAINT \`chk_company_account_mappings_confidence\` CHECK (\`confidence\` IS NULL OR (\`confidence\` >= 0 AND \`confidence\` <= 1)),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_company_account_mappings_company_account_id\` FOREIGN KEY (\`company_account_id\`) REFERENCES \`company_accounts\`(\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_company_account_mappings_sii_account_id\` FOREIGN KEY (\`sii_account_id\`) REFERENCES \`sii_accounts\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE `company_account_mappings`");
    await queryRunner.query("DROP TABLE `company_accounts`");
    await queryRunner.query("DROP TABLE `company_account_plan_versions`");
    await queryRunner.query(
      "ALTER TABLE `stored_files` MODIFY `category` enum ('balance','journal','ledger','xml','declaration','report','other') NOT NULL",
    );
  }
}

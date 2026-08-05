import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from "typeorm";

const auditColumns = [
  {
    name: "id",
    type: "char",
    length: "36",
    isPrimary: true,
  },
  {
    name: "created_at",
    type: "datetime",
    precision: 6,
    default: "CURRENT_TIMESTAMP(6)",
  },
  {
    name: "updated_at",
    type: "datetime",
    precision: 6,
    default: "CURRENT_TIMESTAMP(6)",
    onUpdate: "CURRENT_TIMESTAMP(6)",
  },
  {
    name: "deleted_at",
    type: "datetime",
    precision: 6,
    isNullable: true,
  },
];

export class CreateProfessionalAccountInference1785034000000 implements MigrationInterface {
  name = "CreateProfessionalAccountInference1785034000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "sii_account_knowledge",
        columns: [
          ...auditColumns,
          {
            name: "sii_account_id",
            type: "char",
            length: "36",
          },
          {
            name: "accounting_family",
            type: "varchar",
            length: "100",
          },
          {
            name: "statement_section",
            type: "varchar",
            length: "30",
          },
          {
            name: "balance_nature",
            type: "varchar",
            length: "10",
          },
          {
            name: "tax_type",
            type: "varchar",
            length: "40",
            default: "'none'",
          },
          {
            name: "financial_type",
            type: "varchar",
            length: "40",
            default: "'none'",
          },
          {
            name: "is_control_account",
            type: "tinyint",
            width: 1,
            default: 0,
          },
          {
            name: "is_contra_account",
            type: "tinyint",
            width: 1,
            default: 0,
          },
          {
            name: "is_current",
            type: "tinyint",
            width: 1,
            isNullable: true,
          },
          {
            name: "is_residual",
            type: "tinyint",
            width: 1,
            default: 0,
          },
          {
            name: "attributes",
            type: "json",
            isNullable: true,
          },
          {
            name: "source",
            type: "varchar",
            length: "100",
            default: "'manual'",
          },
          {
            name: "active",
            type: "tinyint",
            width: 1,
            default: 1,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      "sii_account_knowledge",
      new TableIndex({
        name: "uq_sii_account_knowledge_account",
        columnNames: ["sii_account_id"],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      "sii_account_knowledge",
      new TableForeignKey({
        name: "fk_sii_account_knowledge_account",
        columnNames: ["sii_account_id"],
        referencedTableName: "sii_accounts",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "account_matching_rules",
        columns: [
          ...auditColumns,
          {
            name: "rule_key",
            type: "varchar",
            length: "100",
          },
          {
            name: "name",
            type: "varchar",
            length: "255",
          },
          {
            name: "priority",
            type: "int",
          },
          {
            name: "condition",
            type: "json",
          },
          {
            name: "action",
            type: "json",
          },
          {
            name: "explanation",
            type: "varchar",
            length: "500",
          },
          {
            name: "active",
            type: "tinyint",
            width: 1,
            default: 1,
          },
        ],
      }),
    );

    await queryRunner.createIndices("account_matching_rules", [
      new TableIndex({
        name: "uq_account_matching_rules_key",
        columnNames: ["rule_key"],
        isUnique: true,
      }),
      new TableIndex({
        name: "idx_account_matching_rules_active_priority",
        columnNames: ["active", "priority"],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: "account_matching_learning",
        columns: [
          ...auditColumns,
          {
            name: "scope",
            type: "enum",
            enum: ["company", "industry", "global"],
          },
          {
            name: "company_id",
            type: "char",
            length: "36",
            isNullable: true,
          },
          {
            name: "industry",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "scope_company_key",
            type: "char",
            length: "36",
            default: "''",
          },
          {
            name: "scope_industry_key",
            type: "varchar",
            length: "255",
            default: "''",
          },
          {
            name: "internal_name",
            type: "varchar",
            length: "500",
          },
          {
            name: "normalized_name",
            type: "varchar",
            length: "500",
          },
          {
            name: "normalized_name_hash",
            type: "char",
            length: "64",
          },
          {
            name: "sii_account_id",
            type: "char",
            length: "36",
          },
          {
            name: "confirmation_count",
            type: "int",
            unsigned: true,
            default: 1,
          },
          {
            name: "distinct_company_count",
            type: "int",
            unsigned: true,
            default: 1,
          },
          {
            name: "last_confirmed_at",
            type: "datetime",
            precision: 6,
          },
          {
            name: "last_confirmed_by_user_id",
            type: "char",
            length: "36",
          },
          {
            name: "promotion_eligible",
            type: "tinyint",
            width: 1,
            default: 0,
          },
          {
            name: "active",
            type: "tinyint",
            width: 1,
            default: 1,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      "account_matching_learning",
      new TableIndex({
        name: "uq_account_matching_learning_identity",
        columnNames: [
          "scope",
          "scope_company_key",
          "scope_industry_key",
          "normalized_name_hash",
          "sii_account_id",
        ],
        isUnique: true,
      }),
    );

    for (const foreignKey of [
      new TableForeignKey({
        name: "fk_account_matching_learning_company",
        columnNames: ["company_id"],
        referencedTableName: "companies",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
      new TableForeignKey({
        name: "fk_account_matching_learning_sii",
        columnNames: ["sii_account_id"],
        referencedTableName: "sii_accounts",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
      new TableForeignKey({
        name: "fk_account_matching_learning_user",
        columnNames: ["last_confirmed_by_user_id"],
        referencedTableName: "users",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
    ]) {
      await queryRunner.createForeignKey(
        "account_matching_learning",
        foreignKey,
      );
    }

    await queryRunner.createTable(
      new Table({
        name: "account_matching_diagnostics",
        columns: [
          ...auditColumns,
          {
            name: "company_id",
            type: "char",
            length: "36",
          },
          {
            name: "tax_period_id",
            type: "char",
            length: "36",
          },
          {
            name: "company_account_id",
            type: "char",
            length: "36",
          },
          {
            name: "account_name",
            type: "varchar",
            length: "500",
          },
          {
            name: "normalized_name",
            type: "varchar",
            length: "500",
          },
          {
            name: "observed_section",
            type: "varchar",
            length: "30",
          },
          {
            name: "decision",
            type: "varchar",
            length: "30",
          },
          {
            name: "decision_reason",
            type: "varchar",
            length: "100",
          },
          {
            name: "algorithm_version",
            type: "varchar",
            length: "50",
          },
          {
            name: "candidates",
            type: "json",
          },
          {
            name: "discarded_candidates",
            type: "json",
          },
          {
            name: "rules_evaluated",
            type: "json",
          },
          {
            name: "generated_at",
            type: "datetime",
            precision: 6,
          },
        ],
      }),
    );

    await queryRunner.createIndex(
      "account_matching_diagnostics",
      new TableIndex({
        name: "idx_account_matching_diagnostics_period",
        columnNames: ["company_id", "tax_period_id", "generated_at"],
      }),
    );

    for (const foreignKey of [
      new TableForeignKey({
        name: "fk_account_matching_diagnostics_company",
        columnNames: ["company_id"],
        referencedTableName: "companies",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
      new TableForeignKey({
        name: "fk_account_matching_diagnostics_period",
        columnNames: ["tax_period_id"],
        referencedTableName: "tax_periods",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
      new TableForeignKey({
        name: "fk_account_matching_diagnostics_account",
        columnNames: ["company_account_id"],
        referencedTableName: "company_accounts",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
    ]) {
      await queryRunner.createForeignKey(
        "account_matching_diagnostics",
        foreignKey,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [
      "account_matching_diagnostics",
      "account_matching_learning",
      "account_matching_rules",
      "sii_account_knowledge",
    ]) {
      await queryRunner.dropTable(table, true);
    }
  }
}

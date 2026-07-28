import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from "typeorm";

export class CreateSiiAccountPlan1785028000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "sii_account_plan_versions",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
          },
          {
            name: "code",
            type: "varchar",
            length: "100",
            isNullable: false,
          },
          {
            name: "name",
            type: "varchar",
            length: "255",
            isNullable: false,
          },
          {
            name: "source_file_name",
            type: "varchar",
            length: "255",
            isNullable: false,
          },
          {
            name: "source_reference",
            type: "varchar",
            length: "500",
            isNullable: true,
          },
          {
            name: "source_checksum",
            type: "varchar",
            length: "128",
            isNullable: false,
          },
          {
            name: "effective_from",
            type: "date",
            isNullable: true,
          },
          {
            name: "effective_to",
            type: "date",
            isNullable: true,
          },
          {
            name: "status",
            type: "enum",
            enum: ["draft", "active", "archived"],
            default: "'draft'",
            isNullable: false,
          },
          {
            name: "imported_at",
            type: "datetime",
            precision: 6,
            isNullable: false,
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
        ],
        indices: [
          {
            name: "uq_sii_account_plan_versions_code",
            columnNames: ["code"],
            isUnique: true,
          },
          {
            name: "uq_sii_account_plan_versions_checksum",
            columnNames: ["source_checksum"],
            isUnique: true,
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "sii_accounts",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
          },
          {
            name: "version_id",
            type: "char",
            length: "36",
          },
          {
            name: "code",
            type: "varchar",
            length: "100",
          },
          {
            name: "name",
            type: "varchar",
            length: "500",
          },
          {
            name: "description",
            type: "text",
            isNullable: true,
          },
          {
            name: "level",
            type: "smallint",
            unsigned: true,
            isNullable: true,
          },
          {
            name: "parent_id",
            type: "char",
            length: "36",
            isNullable: true,
          },
          {
            name: "sort_order",
            type: "int",
            unsigned: true,
          },
          {
            name: "source_row_number",
            type: "int",
            unsigned: true,
          },
          {
            name: "raw_data",
            type: "json",
            isNullable: true,
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
        ],
        indices: [
          {
            name: "uq_sii_accounts_version_code",
            columnNames: ["version_id", "code"],
            isUnique: true,
          },
          {
            name: "idx_sii_accounts_version_id",
            columnNames: ["version_id"],
          },
          {
            name: "idx_sii_accounts_parent_id",
            columnNames: ["parent_id"],
          },
          {
            name: "idx_sii_accounts_name",
            columnNames: ["name"],
          },
          {
            name: "idx_sii_accounts_sort_order",
            columnNames: ["sort_order"],
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      "sii_accounts",
      new TableForeignKey({
        name: "fk_sii_accounts_version_id",
        columnNames: ["version_id"],
        referencedTableName: "sii_account_plan_versions",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
    );
    await queryRunner.createForeignKey(
      "sii_accounts",
      new TableForeignKey({
        name: "fk_sii_accounts_parent_id",
        columnNames: ["parent_id"],
        referencedTableName: "sii_accounts",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("sii_accounts", true);
    await queryRunner.dropTable("sii_account_plan_versions", true);
  }
}

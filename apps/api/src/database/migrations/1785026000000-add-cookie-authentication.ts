import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from "typeorm";
export class AddCookieAuthentication1785026000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      "users",
      "password_hash",
      new TableColumn({
        name: "password_hash",
        type: "varchar",
        length: "255",
        isNullable: true,
      }),
    );
    await queryRunner.addColumns("users", [
      new TableColumn({
        name: "password_changed_at",
        type: "datetime",
        precision: 6,
        isNullable: true,
      }),
      new TableColumn({
        name: "failed_login_attempts",
        type: "smallint",
        unsigned: true,
        default: 0,
      }),
      new TableColumn({
        name: "locked_until",
        type: "datetime",
        precision: 6,
        isNullable: true,
      }),
    ]);
    await queryRunner.createTable(
      new Table({
        name: "auth_sessions",
        columns: [
          { name: "id", type: "char", length: "36", isPrimary: true },
          { name: "user_id", type: "char", length: "36" },
          { name: "refresh_token_hash", type: "varchar", length: "255" },
          {
            name: "current_organization_id",
            type: "char",
            length: "36",
            isNullable: true,
          },
          { name: "expires_at", type: "datetime", precision: 6 },
          {
            name: "revoked_at",
            type: "datetime",
            precision: 6,
            isNullable: true,
          },
          {
            name: "replaced_by_session_id",
            type: "char",
            length: "36",
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
            name: "last_used_at",
            type: "datetime",
            precision: 6,
            isNullable: true,
          },
          {
            name: "ip_address",
            type: "varchar",
            length: "45",
            isNullable: true,
          },
          {
            name: "user_agent",
            type: "varchar",
            length: "500",
            isNullable: true,
          },
        ],
        indices: [
          new TableIndex({
            name: "idx_auth_sessions_user_id",
            columnNames: ["user_id"],
          }),
          new TableIndex({
            name: "idx_auth_sessions_expires_at",
            columnNames: ["expires_at"],
          }),
          new TableIndex({
            name: "idx_auth_sessions_revoked_at",
            columnNames: ["revoked_at"],
          }),
          new TableIndex({
            name: "idx_auth_sessions_replaced_by_session_id",
            columnNames: ["replaced_by_session_id"],
          }),
        ],
        foreignKeys: [
          new TableForeignKey({
            name: "fk_auth_sessions_user_id",
            columnNames: ["user_id"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "RESTRICT",
          }),
          new TableForeignKey({
            name: "fk_auth_sessions_replaced_by_session_id",
            columnNames: ["replaced_by_session_id"],
            referencedTableName: "auth_sessions",
            referencedColumnNames: ["id"],
            onDelete: "SET NULL",
          }),
          new TableForeignKey({
            name: "fk_auth_sessions_current_organization_id",
            columnNames: ["current_organization_id"],
            referencedTableName: "organizations",
            referencedColumnNames: ["id"],
            onDelete: "SET NULL",
          }),
        ],
      }),
      true,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("auth_sessions");
    await queryRunner.dropColumn("users", "locked_until");
    await queryRunner.dropColumn("users", "failed_login_attempts");
    await queryRunner.dropColumn("users", "password_changed_at");
    await queryRunner.changeColumn(
      "users",
      "password_hash",
      new TableColumn({
        name: "password_hash",
        type: "varchar",
        length: "255",
      }),
    );
  }
}

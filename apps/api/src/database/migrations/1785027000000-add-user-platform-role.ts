import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddUserPlatformRole1785027000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "users",
      new TableColumn({
        name: "platform_role",
        type: "enum",
        enum: ["user", "metauser"],
        default: "'user'",
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("users", "platform_role");
  }
}

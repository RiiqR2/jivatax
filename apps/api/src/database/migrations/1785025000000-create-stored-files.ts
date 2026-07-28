import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from "typeorm";

export class CreateStoredFiles1785024100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "stored_files",
        columns: [
          {
            name: "id",
            type: "char",
            length: "36",
            isPrimary: true,
          },
          {
            name: "company_id",
            type: "char",
            length: "36",
          },

          /*
           * Ubicación física del archivo.
           *
           * El bucket y el object_key permiten utilizar MinIO durante
           * el desarrollo y reemplazarlo después por otro proveedor.
           */
          {
            name: "bucket",
            type: "varchar",
            length: "100",
          },
          {
            name: "object_key",
            type: "varchar",
            length: "500",
          },

          /*
           * Información original del archivo.
           */
          {
            name: "original_name",
            type: "varchar",
            length: "255",
          },
          {
            name: "extension",
            type: "varchar",
            length: "20",
          },
          {
            name: "content_type",
            type: "varchar",
            length: "255",
          },
          {
            name: "size_bytes",
            type: "bigint",
            unsigned: true,
          },

          /*
           * input:
           * Archivo proporcionado por el usuario.
           *
           * output:
           * Archivo generado por JivaTax.
           */
          {
            name: "direction",
            type: "enum",
            enum: ["input", "output"],
            default: "'input'",
          },

          /*
           * Clasificación funcional del documento.
           */
          {
            name: "category",
            type: "enum",
            enum: [
              "balance",
              "journal",
              "ledger",
              "xml",
              "declaration",
              "report",
              "other",
            ],
          },

          /*
           * Por ahora solamente utilizaremos uploaded.
           * Los demás valores quedan preparados para las próximas etapas.
           */
          {
            name: "status",
            type: "enum",
            enum: [
              "uploaded",
              "processing",
              "processed",
              "failed",
              "generated",
            ],
            default: "'uploaded'",
          },

          /*
           * Auditoría.
           */
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
          {
            name: "created_by_user_id",
            type: "char",
            length: "36",
            isNullable: true,
          },
          {
            name: "updated_by_user_id",
            type: "char",
            length: "36",
            isNullable: true,
          },
          {
            name: "deleted_by_user_id",
            type: "char",
            length: "36",
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      "stored_files",
      new TableIndex({
        name: "uq_stored_files_bucket_object_key",
        columnNames: ["bucket", "object_key"],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      "stored_files",
      new TableIndex({
        name: "idx_stored_files_company_id",
        columnNames: ["company_id"],
      }),
    );

    await queryRunner.createIndex(
      "stored_files",
      new TableIndex({
        name: "idx_stored_files_company_direction",
        columnNames: ["company_id", "direction"],
      }),
    );

    await queryRunner.createIndex(
      "stored_files",
      new TableIndex({
        name: "idx_stored_files_company_category",
        columnNames: ["company_id", "category"],
      }),
    );

    await queryRunner.createIndex(
      "stored_files",
      new TableIndex({
        name: "idx_stored_files_company_status",
        columnNames: ["company_id", "status"],
      }),
    );

    await queryRunner.createForeignKey(
      "stored_files",
      new TableForeignKey({
        name: "fk_stored_files_company_id",
        columnNames: ["company_id"],
        referencedTableName: "companies",
        referencedColumnNames: ["id"],
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("stored_files", true);
  }
}

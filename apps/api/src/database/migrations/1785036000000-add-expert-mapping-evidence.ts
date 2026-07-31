import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExpertMappingEvidence1785036000000 implements MigrationInterface {
  name = "AddExpertMappingEvidence1785036000000";
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE account_matching_confirmations ADD source_reference char(64) NULL, ADD UNIQUE INDEX uq_confirmations_source_ref (source_reference)`,
    );
    await q.query(
      `ALTER TABLE account_matching_learning ADD expert_confirmation_count int unsigned NOT NULL DEFAULT 0`,
    );
    await q.query(
      `ALTER TABLE account_matching_learning_industries ADD expert_confirmation_count int unsigned NOT NULL DEFAULT 0`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE account_matching_learning_industries DROP COLUMN expert_confirmation_count`,
    );
    await q.query(
      `ALTER TABLE account_matching_learning DROP COLUMN expert_confirmation_count`,
    );
    await q.query(
      `ALTER TABLE account_matching_confirmations DROP INDEX uq_confirmations_source_ref, DROP COLUMN source_reference`,
    );
  }
}

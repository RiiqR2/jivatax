import { MigrationInterface, QueryRunner } from "typeorm";

/** Makes the externally curated SII code, rather than a catalog-row UUID, durable. */
export class StabilizeWorkPaperApplicability1785044000000 implements MigrationInterface {
  name = "StabilizeWorkPaperApplicability1785044000000";
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE tax_work_paper_applicabilities ADD sii_account_code varchar(100) NULL AFTER definition_id`,
    );
    await q.query(
      `UPDATE tax_work_paper_applicabilities a JOIN sii_accounts s ON s.id=a.sii_account_id SET a.sii_account_code=s.code`,
    );
    await q.query(
      `ALTER TABLE tax_work_paper_applicabilities DROP INDEX uq_work_paper_applicability_role, CHANGE sii_account_id legacy_sii_account_id char(36) NULL, MODIFY sii_account_code varchar(100) NOT NULL, ADD UNIQUE KEY uq_work_paper_applicability_role (definition_id,sii_account_code,role_key), ADD KEY idx_work_paper_applicability_sii_code (sii_account_code)`,
    );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `UPDATE tax_work_paper_applicabilities a JOIN sii_accounts s ON s.code=a.sii_account_code JOIN sii_account_plan_versions v ON v.id=s.version_id AND v.status='active' SET a.legacy_sii_account_id=s.id WHERE a.legacy_sii_account_id IS NULL`,
    );
    await q.query(
      `ALTER TABLE tax_work_paper_applicabilities DROP INDEX idx_work_paper_applicability_sii_code, DROP INDEX uq_work_paper_applicability_role, CHANGE legacy_sii_account_id sii_account_id char(36) NOT NULL, DROP sii_account_code, ADD UNIQUE KEY uq_work_paper_applicability_role (definition_id,sii_account_id,role_key)`,
    );
  }
}

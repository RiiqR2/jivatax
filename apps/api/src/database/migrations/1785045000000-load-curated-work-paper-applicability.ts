import { MigrationInterface, QueryRunner } from "typeorm";
import {
  CURATED_APPLICABILITY_MATRIX_VERSION,
  CURATED_APPLICABILITY_SOURCE_ROWS,
} from "../../tax-work-papers/data/curated-applicability-matrix";
import {
  APPLICABILITY_ONLY_ROLE,
  compileCuratedApplicability,
} from "../../tax-work-papers/data/compile-curated-applicability";

/**
 * Seeds durable A.1–A.20 applicabilities from the versioned curated matrix.
 * Identity is (definition, siiAccountCode, roleKey); catalog UUIDs are never stored.
 */
export class LoadCuratedWorkPaperApplicability1785045000000 implements MigrationInterface {
  name = "LoadCuratedWorkPaperApplicability1785045000000";

  async up(q: QueryRunner): Promise<void> {
    const permissiveCatalog = new Set(
      CURATED_APPLICABILITY_SOURCE_ROWS.map((row) => row.siiAccountCode.trim()),
    );
    const report = compileCuratedApplicability(
      CURATED_APPLICABILITY_SOURCE_ROWS,
      permissiveCatalog,
    );
    for (const association of report.validAssociations) {
      const rationale = `curated:${CURATED_APPLICABILITY_MATRIX_VERSION};sourceRows=${association.sourceRows.join(",")}`;
      await q.query(
        `INSERT INTO tax_work_paper_applicabilities
          (id, definition_id, sii_account_code, legacy_sii_account_id, role_key, rationale, is_active)
         SELECT UUID(), d.id, ?, NULL, ?, ?, 1
           FROM tax_work_paper_definitions d
          WHERE d.code = ? AND d.version = 1 AND d.deleted_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM tax_work_paper_applicabilities a
               WHERE a.definition_id = d.id
                 AND a.sii_account_code = ?
                 AND a.role_key = ?
                 AND a.deleted_at IS NULL
            )`,
        [
          association.siiAccountCode,
          association.roleKey || APPLICABILITY_ONLY_ROLE,
          rationale,
          association.workPaperCode,
          association.siiAccountCode,
          association.roleKey || APPLICABILITY_ONLY_ROLE,
        ],
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DELETE FROM tax_work_paper_applicabilities
        WHERE rationale LIKE ? AND role_key = ?`,
      [
        `curated:${CURATED_APPLICABILITY_MATRIX_VERSION};%`,
        APPLICABILITY_ONLY_ROLE,
      ],
    );
  }
}

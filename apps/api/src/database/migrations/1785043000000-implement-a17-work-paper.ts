import { MigrationInterface, QueryRunner } from "typeorm";

/** Activates only exact, unambiguous catalog labels; absent roles remain deliberately uncurated. */
export class ImplementA17WorkPaper1785043000000 implements MigrationInterface {
  name = "ImplementA17WorkPaper1785043000000";
  async up(q: QueryRunner): Promise<void> {
    const requiredInputs = [
      "LEASE_LIABILITY_OPENING",
      "LEASE_LIABILITY_CLOSING",
      "DEFERRED_INTEREST_OPENING",
      "DEFERRED_INTEREST_CLOSING",
      "NEW_LEASE_CONTRACTS",
      "LEASE_PAYMENTS",
      "LEASE_MONETARY_CORRECTION",
      "LEASE_REMEASUREMENTS",
      "DEFERRED_INTEREST_AMORTIZATION",
      "OTHER_LEASE_MOVEMENTS",
    ];
    await q.query(
      `UPDATE tax_work_paper_definitions SET description=?, metadata=?, required_inputs=?, possible_outputs=? WHERE code='A.17' AND version=1`,
      [
        "Roll-forward y conciliación de obligación e interés diferido de leasing del arrendatario.",
        JSON.stringify({
          calculatorKey: "A.17@1",
          documentationStatus: "implemented_pending_tax_review",
        }),
        JSON.stringify(requiredInputs),
        JSON.stringify([
          "reconciliations",
          "taxAdjustments",
          "missingInputs",
          "warnings",
        ]),
      ],
    );
    for (const item of [
      {
        name: "Obligaciones por Leasing",
        role: "LEASE_LIABILITY",
        rationale: "Cuenta SII explícita de obligación por leasing.",
      },
      {
        name: "Intereses diferidos leasing",
        role: "DEFERRED_LEASE_INTEREST",
        rationale: "Cuenta SII explícita de interés diferido de leasing.",
      },
    ])
      await q.query(
        `INSERT IGNORE INTO tax_work_paper_applicabilities (id,definition_id,sii_account_id,role_key,rationale,is_active)
       SELECT UUID(),d.id,s.id,?,?,1 FROM tax_work_paper_definitions d JOIN sii_accounts s ON s.name=? AND s.deleted_at IS NULL
       JOIN sii_account_plan_versions v ON v.id=s.version_id AND v.status='active' AND v.deleted_at IS NULL
       WHERE d.code='A.17' AND d.version=1 AND d.deleted_at IS NULL`,
        [item.role, item.rationale, item.name],
      );
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `DELETE a FROM tax_work_paper_applicabilities a JOIN tax_work_paper_definitions d ON d.id=a.definition_id WHERE d.code='A.17' AND d.version=1 AND a.role_key IN ('LEASE_LIABILITY','DEFERRED_LEASE_INTEREST')`,
    );
    await q.query(
      `UPDATE tax_work_paper_definitions SET description='Definición base; cálculo tributario pendiente de implementación.', metadata=JSON_OBJECT('calculatorKey','A.17@1','documentationStatus','pending_tax_review'), required_inputs=JSON_ARRAY(), possible_outputs=JSON_ARRAY() WHERE code='A.17' AND version=1`,
    );
  }
}

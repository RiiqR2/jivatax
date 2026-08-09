import { MigrationInterface, QueryRunner } from "typeorm";

/** Configures A.17; stable SII codes are supplied only by the curated matrix. */
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
      "NEW_DEFERRED_INTEREST",
      "DEFERRED_INTEREST_MONETARY_CORRECTION",
      "DEFERRED_INTEREST_REMEASUREMENTS",
      "OTHER_DEFERRED_INTEREST_MOVEMENTS",
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
    // Codes are supplied by the externally curated applicability matrix. This
    // migration intentionally does not infer them from catalog names.
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

import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTaxWorkPapers1785042000000 implements MigrationInterface {
  name = "CreateTaxWorkPapers1785042000000";
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE tax_work_paper_definitions (id char(36) NOT NULL, code varchar(20) NOT NULL, name varchar(255) NOT NULL, description text NULL, version int unsigned NOT NULL, effective_from date NULL, effective_to date NULL, status enum('draft','active','retired') NOT NULL, metadata json NULL, required_inputs json NULL, possible_outputs json NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL, UNIQUE KEY uq_tax_work_paper_definition_version (code, version), PRIMARY KEY (id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    await q.query(
      `CREATE TABLE tax_work_paper_applicabilities (id char(36) NOT NULL, definition_id char(36) NOT NULL, sii_account_id char(36) NOT NULL, role_key varchar(100) NOT NULL, rationale text NULL, is_active tinyint NOT NULL DEFAULT 1, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL, UNIQUE KEY uq_work_paper_applicability_role (definition_id,sii_account_id,role_key), KEY idx_work_paper_applicability_sii (sii_account_id), PRIMARY KEY (id), CONSTRAINT fk_work_paper_app_definition FOREIGN KEY (definition_id) REFERENCES tax_work_paper_definitions(id) ON DELETE RESTRICT, CONSTRAINT fk_work_paper_app_sii FOREIGN KEY (sii_account_id) REFERENCES sii_accounts(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    await q.query(
      `CREATE TABLE tax_work_paper_executions (id char(36) NOT NULL, company_id char(36) NOT NULL, tax_period_id char(36) NOT NULL, definition_id char(36) NOT NULL, revision int unsigned NOT NULL, status enum('draft','finalized') NOT NULL DEFAULT 'draft', supersedes_execution_id char(36) NULL, created_by_user_id char(36) NOT NULL, reviewed_by_user_id char(36) NULL, finalized_at datetime(6) NULL, result_snapshot json NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL, UNIQUE KEY uq_work_paper_execution_revision (company_id,tax_period_id,definition_id,revision), KEY idx_work_paper_execution_period (company_id,tax_period_id), PRIMARY KEY (id), CONSTRAINT fk_work_paper_exec_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT, CONSTRAINT fk_work_paper_exec_period FOREIGN KEY (tax_period_id) REFERENCES tax_periods(id) ON DELETE RESTRICT, CONSTRAINT fk_work_paper_exec_definition FOREIGN KEY (definition_id) REFERENCES tax_work_paper_definitions(id) ON DELETE RESTRICT, CONSTRAINT fk_work_paper_exec_supersedes FOREIGN KEY (supersedes_execution_id) REFERENCES tax_work_paper_executions(id) ON DELETE RESTRICT, CONSTRAINT fk_work_paper_exec_creator FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE RESTRICT, CONSTRAINT fk_work_paper_exec_reviewer FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    await q.query(
      `CREATE TABLE tax_work_paper_inputs (id char(36) NOT NULL, execution_id char(36) NOT NULL, input_key varchar(100) NOT NULL, source_type enum('balance','general_ledger','tax_document','auxiliary','manual','economic_series','prior_period','work_paper_execution') NOT NULL, source_entity_type varchar(80) NULL, source_entity_id char(36) NULL, value_snapshot decimal(24,4) NULL, payload_snapshot json NULL, revision int unsigned NOT NULL, status enum('draft','finalized','void') NOT NULL DEFAULT 'draft', created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL, UNIQUE KEY uq_work_paper_input_revision (execution_id,input_key,revision), PRIMARY KEY (id), CONSTRAINT fk_work_paper_input_execution FOREIGN KEY (execution_id) REFERENCES tax_work_paper_executions(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    await q.query(
      `CREATE TABLE tax_work_paper_dependencies (id char(36) NOT NULL, execution_id char(36) NOT NULL, depends_on_execution_id char(36) NOT NULL, dependency_key varchar(100) NOT NULL, description text NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL, UNIQUE KEY uq_work_paper_dependency (execution_id,depends_on_execution_id), CHECK (execution_id <> depends_on_execution_id), PRIMARY KEY (id), CONSTRAINT fk_work_paper_dep_execution FOREIGN KEY (execution_id) REFERENCES tax_work_paper_executions(id) ON DELETE RESTRICT, CONSTRAINT fk_work_paper_dep_source FOREIGN KEY (depends_on_execution_id) REFERENCES tax_work_paper_executions(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    await q.query(
      `CREATE TABLE tax_adjustments (id char(36) NOT NULL, company_id char(36) NOT NULL, tax_period_id char(36) NOT NULL, execution_id char(36) NOT NULL, type enum('RLI_ADD','RLI_DEDUCT','CPT_ASSET_ADD','CPT_ASSET_DEDUCT','CPT_LIABILITY_ADD','CPT_LIABILITY_DEDUCT','DEFERRED_TAX_ASSET','DEFERRED_TAX_LIABILITY') NOT NULL, amount decimal(24,4) NOT NULL, description text NOT NULL, difference_nature enum('temporary','permanent','not_applicable') NULL, rule_key varchar(150) NOT NULL, revision int unsigned NOT NULL, status enum('draft','finalized','void') NOT NULL DEFAULT 'draft', created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL, KEY idx_tax_adjustments_tenant_period (company_id,tax_period_id,type), PRIMARY KEY (id), CONSTRAINT fk_tax_adjustment_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT, CONSTRAINT fk_tax_adjustment_period FOREIGN KEY (tax_period_id) REFERENCES tax_periods(id) ON DELETE RESTRICT, CONSTRAINT fk_tax_adjustment_execution FOREIGN KEY (execution_id) REFERENCES tax_work_paper_executions(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    await q.query(
      `CREATE TABLE tax_work_paper_evidence (id char(36) NOT NULL, execution_id char(36) NOT NULL, input_id char(36) NULL, adjustment_id char(36) NULL, evidence_type varchar(80) NOT NULL, source_entity_type varchar(80) NOT NULL, source_entity_id char(36) NOT NULL, locator json NULL, description text NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), deleted_at datetime(6) NULL, KEY idx_work_paper_evidence_execution (execution_id), PRIMARY KEY (id), CONSTRAINT fk_work_paper_evidence_execution FOREIGN KEY (execution_id) REFERENCES tax_work_paper_executions(id) ON DELETE RESTRICT, CONSTRAINT fk_work_paper_evidence_input FOREIGN KEY (input_id) REFERENCES tax_work_paper_inputs(id) ON DELETE RESTRICT, CONSTRAINT fk_work_paper_evidence_adjustment FOREIGN KEY (adjustment_id) REFERENCES tax_adjustments(id) ON DELETE RESTRICT) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
    const names = [
      "Deudores Incobrables",
      "Existencias",
      "Provisión Obsolescencia",
      "Inversiones Financieras y Tributarias",
      "Activo Fijo",
      "Deudores por Leasing",
      "Bienes Entregados en Leasing",
      "Indemnización por Años de Servicio",
      "Impuestos Diferidos",
      "Impuesto a la Renta",
      "Patrimonio Financiero y Tributario",
      "Provisiones Varias",
      "Multas Fiscales",
      "Gastos Rechazados",
      "Impuesto Único",
      "PPM",
      "Obligación en Leasing",
      "Intangibles",
      "Papel Abierto",
      "Pérdida Tributaria",
    ];
    for (let i = 0; i < names.length; i++)
      await q.query(
        `INSERT INTO tax_work_paper_definitions (id,code,name,description,version,effective_from,effective_to,status,metadata,required_inputs,possible_outputs) VALUES (UUID(),?,?,?,?,NULL,NULL,'active',?,JSON_ARRAY(),JSON_ARRAY())`,
        [
          `A.${i + 1}`,
          names[i],
          "Definición base; cálculo tributario pendiente de implementación.",
          1,
          JSON.stringify({
            calculatorKey: `A.${i + 1}@1`,
            documentationStatus: "pending_tax_review",
          }),
        ],
      );
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of [
      "tax_work_paper_evidence",
      "tax_adjustments",
      "tax_work_paper_dependencies",
      "tax_work_paper_inputs",
      "tax_work_paper_executions",
      "tax_work_paper_applicabilities",
      "tax_work_paper_definitions",
    ])
      await q.query(`DROP TABLE ${table}`);
  }
}

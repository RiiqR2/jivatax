import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateWorkPaperJobs1785046000000 implements MigrationInterface {
  name = "CreateWorkPaperJobs1785046000000";

  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `CREATE TABLE tax_work_paper_jobs (
        id char(36) NOT NULL,
        company_id char(36) NOT NULL,
        tax_period_id char(36) NOT NULL,
        execution_id char(36) NOT NULL,
        job_type enum('calculator_run') NOT NULL,
        status enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
        attempt int unsigned NOT NULL DEFAULT 1,
        progress tinyint unsigned NULL,
        requested_by_user_id char(36) NOT NULL,
        started_at datetime(6) NULL,
        completed_at datetime(6) NULL,
        failed_at datetime(6) NULL,
        payload json NULL,
        result_reference json NULL,
        error_detail json NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        KEY idx_work_paper_job_tenant_period (company_id,tax_period_id),
        KEY idx_work_paper_job_execution (execution_id),
        KEY idx_work_paper_job_status_created (status,created_at),
        PRIMARY KEY (id),
        CONSTRAINT fk_work_paper_job_execution FOREIGN KEY (execution_id) REFERENCES tax_work_paper_executions(id) ON DELETE RESTRICT,
        CONSTRAINT fk_work_paper_job_requester FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE tax_work_paper_jobs`);
  }
}

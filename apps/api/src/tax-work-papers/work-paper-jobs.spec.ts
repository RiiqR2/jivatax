import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getMetadataArgsStorage } from "typeorm";
import { WorkPaperJobEntity } from "./entities/work-paper-job.entity";
import { WorkPaperJobService } from "./services/work-paper-job.service";
import { WorkPaperJobStatus, WorkPaperJobType } from "./tax-work-paper.enums";

describe("work paper async jobs", () => {
  it("persists jobs with tenant, execution and lifecycle timestamps", () => {
    const columns = getMetadataArgsStorage()
      .columns.filter((column) => column.target === WorkPaperJobEntity)
      .map((column) => column.propertyName);
    assert.deepEqual(
      [
        "companyId",
        "taxPeriodId",
        "executionId",
        "jobType",
        "status",
        "attempt",
        "requestedByUserId",
        "startedAt",
        "completedAt",
        "failedAt",
        "payload",
        "resultReference",
        "errorDetail",
      ].every((key) => columns.includes(key)),
      true,
    );
  });

  it("migration creates tax_work_paper_jobs without destructive cascades", () => {
    const migration = readFileSync(
      "src/database/migrations/1785046000000-create-work-paper-jobs.ts",
      "utf8",
    );
    assert.match(migration, /tax_work_paper_jobs/);
    assert.match(migration, /pending','running','completed','failed/);
    assert.match(migration, /ON DELETE RESTRICT/);
    assert.doesNotMatch(migration, /ON DELETE CASCADE/);
    assert.doesNotMatch(migration, /DROP TABLE tax_work_paper_executions/);
  });

  it("enqueue reuses pending or running jobs for the same execution", () => {
    const service = readFileSync(
      "src/tax-work-papers/services/work-paper-job.service.ts",
      "utf8",
    );
    assert.match(
      service,
      /WorkPaperJobStatus\.PENDING, WorkPaperJobStatus\.RUNNING/,
    );
    assert.match(service, /if \(active\) return active/);
  });

  it("claim uses pessimistic lock and marks running before processing", () => {
    const service = readFileSync(
      "src/tax-work-papers/services/work-paper-job.service.ts",
      "utf8",
    );
    assert.match(service, /setLock\("pessimistic_write"\)/);
    assert.match(service, /WorkPaperJobStatus\.RUNNING/);
  });

  it("calculation endpoint enqueues and returns immediately", () => {
    const controller = readFileSync(
      "src/tax-work-papers/tax-work-papers.controller.ts",
      "utf8",
    );
    const service = readFileSync(
      "src/tax-work-papers/tax-work-papers.service.ts",
      "utf8",
    );
    assert.match(controller, /enqueueCalculation/);
    assert.match(controller, /executions\/:executionId\/calculations/);
    assert.match(controller, /jobs\/:jobId/);
    assert.match(controller, /summary/);
    assert.match(service, /return \{ id: job\.id, status: job\.status \}/);
    const enqueue = service.slice(
      service.indexOf("async enqueueCalculation"),
      service.indexOf("async getJob"),
    );
    assert.doesNotMatch(enqueue, /await this\.a17Calculator\.calculate/);
  });

  it("worker invokes calculator inside transaction and marks completed or failed", () => {
    const service = readFileSync(
      "src/tax-work-papers/tax-work-papers.service.ts",
      "utf8",
    );
    const processor = readFileSync(
      "src/tax-work-papers/services/work-paper-job.processor.ts",
      "utf8",
    );
    assert.match(service, /processCalculatorRunJob/);
    assert.match(service, /executeA17Calculation/);
    assert.match(service, /markCompleted/);
    assert.match(service, /markFailed/);
    assert.match(processor, /claimNextPending/);
    assert.match(processor, /processCalculatorRunJob/);
  });

  it("failed jobs preserve structured error without deleting history", () => {
    const service = readFileSync(
      "src/tax-work-papers/services/work-paper-job.service.ts",
      "utf8",
    );
    assert.match(service, /job\.errorDetail = detail/);
    assert.match(service, /attempt: previousAttempts \+ 1/);
    assert.doesNotMatch(service, /\.delete\(|\.remove\(/);
  });

  it("execution detail exposes active and latest job for polling", () => {
    const service = readFileSync(
      "src/tax-work-papers/tax-work-papers.service.ts",
      "utf8",
    );
    assert.match(service, /activeJob:/);
    assert.match(service, /latestJob:/);
  });

  it("does not auto-finalize executions from job completion", () => {
    const service = readFileSync(
      "src/tax-work-papers/tax-work-papers.service.ts",
      "utf8",
    );
    const calculation = service.slice(
      service.indexOf("private async executeA17Calculation"),
      service.indexOf("private async resolveA17ClosingInputs"),
    );
    assert.doesNotMatch(calculation, /FINALIZED/);
    assert.doesNotMatch(calculation, /finalizedAt/);
  });

  it("job enums stay minimal", () => {
    assert.deepEqual(Object.values(WorkPaperJobStatus), [
      "pending",
      "running",
      "completed",
      "failed",
    ]);
    assert.equal(WorkPaperJobType.CALCULATOR_RUN, "calculator_run");
  });

  it("processor skips polling in test environment", () => {
    const processor = readFileSync(
      "src/tax-work-papers/services/work-paper-job.processor.ts",
      "utf8",
    );
    assert.match(processor, /NODE_ENV === "test"/);
  });
});

describe("WorkPaperJobService enqueue guard", () => {
  it("rejects mismatched definition for execution", async () => {
    const executions = {
      findOne: async () => ({
        id: "exec-1",
        companyId: "company-1",
        taxPeriodId: "period-1",
        definition: { code: "A.17", version: 1 },
      }),
    };
    const jobs = {
      findOne: async () => null,
      count: async () => 0,
      create: () => ({}),
      save: async (job: { id: string }) => ({ ...job, id: "job-1" }),
    };
    const service = new WorkPaperJobService(
      jobs as never,
      executions as never,
      {} as never,
    );
    await assert.rejects(
      () =>
        service.enqueueCalculatorRun({
          companyId: "company-1",
          taxPeriodId: "period-1",
          executionId: "exec-1",
          userId: "user-1",
          definitionCode: "A.5",
          definitionVersion: 1,
          manualInputs: [],
        }),
      /no corresponde al papel solicitado/,
    );
  });
});

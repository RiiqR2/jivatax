import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  WorkPaperExecutionStatus,
  WorkPaperJobStatus,
} from "./tax-work-paper.enums";
import { buildPeriodSummaryRows } from "./work-paper-period-summary.mapper";

describe("work paper period summary", () => {
  it("reflects execution, job and snapshot metrics without inventing data", () => {
    const rows = buildPeriodSummaryRows(
      [
        {
          definitionId: "def-a17",
          code: "A.17",
          name: "Arrendamientos",
          definitionVersion: 1,
          executions: [
            {
              id: "exec-1",
              status: WorkPaperExecutionStatus.DRAFT,
              revision: 1,
            },
          ],
        },
        {
          definitionId: "def-a5",
          code: "A.5",
          name: "Pérdida",
          definitionVersion: 1,
          executions: [],
        },
      ],
      new Map([
        [
          "exec-1",
          {
            id: "exec-1",
            resultSnapshot: {
              missingInputs: ["LEASE_PAYMENTS"],
              reconciliations: [{ status: "warning" }],
              calculatedValues: { requiresProfessionalReview: true },
            },
          },
        ],
      ]),
      new Map([
        [
          "exec-1",
          {
            id: "job-1",
            executionId: "exec-1",
            status: WorkPaperJobStatus.RUNNING,
          } as never,
        ],
      ]),
      new Map([
        ["exec-1", { executionId: "exec-1", count: 2, total: "1500.0000" }],
      ]),
    );

    assert.equal(rows[0].executionStatus, "draft");
    assert.equal(rows[0].latestJobStatus, WorkPaperJobStatus.RUNNING);
    assert.equal(rows[0].missingInputsCount, 1);
    assert.equal(rows[0].reconciliationWarningsCount, 1);
    assert.equal(rows[0].requiresProfessionalReview, true);
    assert.equal(rows[0].proposedAdjustmentsCount, 2);
    assert.equal(rows[0].proposedAdjustmentsTotal, "1500.0000");
    assert.equal(rows[1].executionStatus, "not_started");
    assert.equal(rows[1].latestJobStatus, null);
  });
});

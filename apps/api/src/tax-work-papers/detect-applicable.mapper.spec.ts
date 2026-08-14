import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  definitionMetadataFields,
  groupApplicableRows,
  type ApplicableRawRow,
} from "./detect-applicable.mapper";
import { WorkPaperExecutionStatus } from "./tax-work-paper.enums";

const baseRow = (
  overrides: Partial<ApplicableRawRow> = {},
): ApplicableRawRow => ({
  definitionId: "def-a5",
  code: "A.5",
  name: "Activo Fijo",
  definitionVersion: 1,
  definitionMetadata: {
    calculatorKey: "A.5@1",
    documentationStatus: "pending_tax_review",
  },
  roleKey: "APPLICABILITY_ONLY",
  rationale: "curated:carga-masiva-plan-cuentas-v2-2026-08-09;sourceRows=36",
  companyAccountId: "ca-1",
  companyAccountCode: "1380200001",
  companyAccountName: "Propiedades De Inversión",
  siiAccountId: "sii-uuid-old",
  siiAccountCode: "1.02.19.00",
  siiAccountName: "Nombre que puede cambiar",
  executionId: "exec-1",
  executionStatus: WorkPaperExecutionStatus.DRAFT,
  executionRevision: 1,
  supersedesExecutionId: null,
  finalizedAt: null,
  ...overrides,
});

describe("groupApplicableRows", () => {
  it("deduplicates relatedAccounts across historical executions without dropping distinct accounts", () => {
    const result = groupApplicableRows([
      baseRow(),
      baseRow({
        executionId: "exec-2",
        executionStatus: WorkPaperExecutionStatus.FINALIZED,
        executionRevision: 2,
        supersedesExecutionId: "exec-1",
        finalizedAt: "2026-08-01T00:00:00.000Z",
      }),
      baseRow({
        companyAccountId: "ca-2",
        companyAccountCode: "1380200002",
        companyAccountName: "Otra cuenta",
        siiAccountId: "sii-other",
        siiAccountCode: "1.02.18.00",
        rationale:
          "curated:carga-masiva-plan-cuentas-v2-2026-08-09;sourceRows=35",
        executionId: "exec-2",
        executionStatus: WorkPaperExecutionStatus.FINALIZED,
        executionRevision: 2,
        supersedesExecutionId: "exec-1",
        finalizedAt: "2026-08-01T00:00:00.000Z",
      }),
    ]);
    assert.equal(result.length, 1);
    assert.deepEqual(
      result[0].relatedAccounts.map((account) => account.companyAccountId),
      ["ca-1", "ca-2"],
    );
    assert.deepEqual(
      result[0].executions.map((execution) => ({
        id: execution.id,
        status: execution.status,
        revision: execution.revision,
        supersedesExecutionId: execution.supersedesExecutionId,
        finalizedAt: execution.finalizedAt,
      })),
      [
        {
          id: "exec-1",
          status: WorkPaperExecutionStatus.DRAFT,
          revision: 1,
          supersedesExecutionId: null,
          finalizedAt: null,
        },
        {
          id: "exec-2",
          status: WorkPaperExecutionStatus.FINALIZED,
          revision: 2,
          supersedesExecutionId: "exec-1",
          finalizedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    );
    assert.equal(
      result[0].relatedAccounts[0].rationale?.includes("sourceRows=36"),
      true,
    );
  });

  it("derives calculatorKey from definition metadata and returns null when absent", () => {
    const withKey = groupApplicableRows([baseRow()]);
    assert.equal(withKey[0].calculatorKey, "A.5@1");
    assert.equal(withKey[0].documentationStatus, "pending_tax_review");
    const withoutKey = groupApplicableRows([
      baseRow({ definitionMetadata: { other: true } }),
    ]);
    assert.equal(withoutKey[0].calculatorKey, null);
    assert.equal(withoutKey[0].documentationStatus, null);
    assert.equal(definitionMetadataFields(null).calculatorKey, null);
    assert.equal(definitionMetadataFields("{}").calculatorKey, null);
  });

  it("does not treat catalog UUID or SII name as identity when grouping accounts", () => {
    const result = groupApplicableRows([
      baseRow({ siiAccountId: "uuid-a", siiAccountName: "Nombre A" }),
      baseRow({
        siiAccountId: "uuid-b",
        siiAccountName: "Nombre B",
        executionId: "exec-2",
        executionRevision: 2,
      }),
    ]);
    assert.equal(result[0].relatedAccounts.length, 1);
    assert.equal(result[0].relatedAccounts[0].siiAccountCode, "1.02.19.00");
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  APPLICABILITY_ONLY_ROLE,
  compileCuratedApplicability,
} from "./compile-curated-applicability";

describe("curated work-paper applicability compiler", () => {
  it("imports A.1-A.20 only and reports zero, A.21+, invalid and empty rows", () => {
    const report = compileCuratedApplicability(
      [
        { sourceRow: 1, workPaperCode: "A.1", siiAccountCode: "1.01.01.00" },
        { sourceRow: 2, workPaperCode: "a.20", siiAccountCode: " 2.01.01.00 " },
        { sourceRow: 3, workPaperCode: "A.21", siiAccountCode: "1.01.01.00" },
        { sourceRow: 4, workPaperCode: "0", siiAccountCode: "1.01.01.00" },
        { sourceRow: 5, workPaperCode: "paper", siiAccountCode: "1.01.01.00" },
        { sourceRow: 6, workPaperCode: "A.2", siiAccountCode: " " },
      ],
      new Set(["1.01.01.00", "2.01.01.00"]),
    );
    assert.equal(report.sourceRowsA1ToA20, 2);
    assert.deepEqual(
      report.validAssociations.map((row) => row.workPaperCode),
      ["A.1", "A.20"],
    );
    assert.deepEqual(
      report.ignoredRows.map((row) => row.reason),
      [
        "paper_out_of_scope",
        "paper_zero",
        "invalid_paper_code",
        "empty_sii_code",
      ],
    );
  });

  it("preserves stable codes, de-duplicates, supports N:M, and never derives roles", () => {
    const rows = [
      { sourceRow: 1, workPaperCode: "A.1", siiAccountCode: "01.02.03.04" },
      { sourceRow: 2, workPaperCode: "A.1", siiAccountCode: "01.02.03.04" },
      { sourceRow: 3, workPaperCode: "A.2", siiAccountCode: "01.02.03.04" },
      { sourceRow: 4, workPaperCode: "A.2", siiAccountCode: "5.06.07.08" },
      {
        sourceRow: 5,
        workPaperCode: "A.17",
        siiAccountCode: "2.02.02.02",
        accountType: "Nombre que parece leasing",
      },
    ];
    const report = compileCuratedApplicability(
      rows,
      new Set(["01.02.03.04", "5.06.07.08", "2.02.02.02"]),
    );
    assert.equal(report.validAssociations.length, 4);
    assert.equal(report.duplicateRows.length, 1);
    assert.deepEqual(report.codesWithMultiplePapers, [
      { siiAccountCode: "01.02.03.04", workPaperCodes: ["A.1", "A.2"] },
    ]);
    assert.ok(
      report.validAssociations.every(
        (row) => row.roleKey === APPLICABILITY_ONLY_ROLE,
      ),
    );
  });

  it("reports catalog misses and does not invent an association", () => {
    const report = compileCuratedApplicability(
      [{ sourceRow: 8, workPaperCode: "A.17", siiAccountCode: "9.99.99.99" }],
      new Set(),
    );
    assert.equal(report.validAssociations.length, 0);
    assert.deepEqual(report.missingCatalogCodes, [
      { siiAccountCode: "9.99.99.99", sourceRows: [8] },
    ]);
  });
});

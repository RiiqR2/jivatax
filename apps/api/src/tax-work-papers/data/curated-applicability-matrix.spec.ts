import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CURATED_APPLICABILITY_MATRIX_VERSION,
  CURATED_APPLICABILITY_SOURCE_ROWS,
} from "./curated-applicability-matrix";
import {
  APPLICABILITY_ONLY_ROLE,
  compileCuratedApplicability,
} from "./compile-curated-applicability";

describe("real curated applicability matrix (Carga Masiva V2)", () => {
  const permissiveCatalog = new Set(
    CURATED_APPLICABILITY_SOURCE_ROWS.map((row) => row.siiAccountCode.trim()),
  );
  const report = compileCuratedApplicability(
    CURATED_APPLICABILITY_SOURCE_ROWS,
    permissiveCatalog,
  );

  it("is a non-empty versioned transcription scoped to the Excel source", () => {
    assert.equal(CURATED_APPLICABILITY_SOURCE_ROWS.length, 156);
    assert.match(
      CURATED_APPLICABILITY_MATRIX_VERSION,
      /carga-masiva-plan-cuentas-v2/,
    );
    assert.equal(report.sourceRowsA1ToA20, 85);
    assert.equal(report.validAssociations.length, 85);
  });

  it("persists only A.1-A.20 associations and never paper 0 or A.21+", () => {
    for (const row of report.validAssociations) {
      const number = Number(row.workPaperCode.slice(2));
      assert.ok(number >= 1 && number <= 20);
      assert.notEqual(row.workPaperCode, "0");
    }
    assert.ok(report.ignoredRows.some((row) => row.reason === "paper_zero"));
    assert.ok(
      report.ignoredRows.some((row) => row.reason === "paper_out_of_scope"),
    );
    assert.equal(
      report.ignoredRows.filter((row) => row.reason === "paper_zero").length,
      64,
    );
    assert.equal(
      report.ignoredRows.filter((row) => row.reason === "paper_out_of_scope")
        .length,
      7,
    );
  });

  it("defaults every association to APPLICABILITY_ONLY without inventing calculator roles", () => {
    assert.ok(
      CURATED_APPLICABILITY_SOURCE_ROWS.every((row) => row.roleKey == null),
    );
    assert.ok(
      report.validAssociations.every(
        (row) => row.roleKey === APPLICABILITY_ONLY_ROLE,
      ),
    );
    assert.doesNotMatch(
      JSON.stringify(report.validAssociations),
      /LEASE_LIABILITY|DEFERRED_LEASE_INTEREST/,
    );
  });

  it("keeps A.17 applicability codes without forcing lease calculator roles", () => {
    const a17 = report.validAssociations
      .filter((row) => row.workPaperCode === "A.17")
      .map((row) => row.siiAccountCode)
      .sort();
    assert.deepEqual(a17, ["1.02.30.00", "1.02.95.00"]);
    assert.ok(
      report.validAssociations
        .filter((row) => row.workPaperCode === "A.17")
        .every((row) => row.roleKey === APPLICABILITY_ONLY_ROLE),
    );
  });

  it("reports papers without associations and has no N:M multipaper codes", () => {
    assert.deepEqual(report.papersWithoutAssociations, [
      "A.3",
      "A.14",
      "A.15",
      "A.20",
    ]);
    assert.deepEqual(report.codesWithMultiplePapers, []);
    assert.equal(report.duplicateRows.length, 0);
  });

  it("never derives associations from account names", () => {
    assert.ok(
      CURATED_APPLICABILITY_SOURCE_ROWS.every(
        (row) =>
          !("siiAccountName" in row) &&
          typeof row.siiAccountCode === "string" &&
          row.siiAccountCode.length > 0,
      ),
    );
  });

  it("reports catalog misses without inventing replacements", () => {
    const miss = compileCuratedApplicability(
      CURATED_APPLICABILITY_SOURCE_ROWS,
      new Set(["1.01.20.00"]),
    );
    assert.ok(miss.missingCatalogCodes.length > 0);
    assert.ok(
      miss.validAssociations.every(
        (row) => row.siiAccountCode === "1.01.20.00",
      ),
    );
    assert.ok(
      !miss.missingCatalogCodes.some(
        (row) => row.siiAccountCode === "1.01.20.00",
      ),
    );
  });
});

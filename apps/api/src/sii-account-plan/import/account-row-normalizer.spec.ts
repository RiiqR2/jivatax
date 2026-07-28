import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RawSiiAccountRow } from "../interfaces/raw-sii-account-row.interface";
import { normalizeRows } from "./account-row-normalizer";
import { validateRows } from "./account-row-validator";
import { resolveHierarchy } from "./account-hierarchy-resolver";

function row(
  sourceRowNumber: number,
  code: string | null,
  name: string | null,
  level: string | null = null,
): RawSiiAccountRow {
  return {
    sourceRowNumber,
    cells: [code, name, level],
    sourceColumns: {
      codigo: code,
      descripcion: name,
      nivel: level,
    },
  };
}

describe("SII account row pipeline", () => {
  it("preserves codes as trimmed strings including leading zeroes", () => {
    const [normalized] = normalizeRows([
      row(3, " 001.02 ", " Caja   nacional "),
    ]);

    assert.equal(normalized.code, "001.02");
    assert.equal(normalized.name, "Caja nacional");
    assert.equal(typeof normalized.code, "string");
  });

  it("removes empty rows and classifies title rows as ignored", () => {
    const normalized = normalizeRows([
      row(3, null, null),
      row(4, null, "ACTIVOS"),
      row(5, "100", "Caja"),
    ]);
    const result = validateRows(normalized);

    assert.equal(normalized.length, 2);
    assert.equal(result.rows.length, 1);
    assert.equal(result.ignoredRows, 1);
  });

  it("rejects a missing account name and duplicate codes", () => {
    const result = validateRows(
      normalizeRows([
        row(3, "100", null),
        row(4, "200", "Banco"),
        row(5, "200", "Banco duplicado"),
      ]),
    );

    assert.ok(result.errors.some((error) => error.includes("nombre ausente")));
    assert.deepEqual(result.duplicateCodes, ["200"]);
  });

  it("uses only explicit levels to resolve hierarchy", () => {
    const validated = validateRows(
      normalizeRows([row(3, "1", "Activo", "1"), row(4, "101", "Caja", "2")]),
    );
    const hierarchy = resolveHierarchy(validated.rows);

    assert.equal(hierarchy.rows[1].parentCode, "1");
    assert.deepEqual(hierarchy.missingParents, []);
  });

  it("leaves hierarchy null when the workbook has no explicit level", () => {
    const validated = validateRows(
      normalizeRows([row(3, "1", "Activo"), row(4, "101", "Caja")]),
    );
    const hierarchy = resolveHierarchy(validated.rows);

    assert.ok(hierarchy.rows.every((account) => account.parentCode === null));
    assert.equal(hierarchy.warnings.length, 1);
  });
});

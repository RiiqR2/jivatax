import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RawSiiAccountRow } from "../interfaces/raw-sii-account-row.interface";
import type { ValidatedSiiAccountRow } from "../interfaces/normalized-sii-account-row.interface";
import { normalizeRows } from "./account-row-normalizer";
import { resolveHierarchy } from "./account-hierarchy-resolver";
import { validateRows } from "./account-row-validator";
import { detectSheet } from "./spreadsheet-reader";

function row(
  number: number,
  code: string | null,
  name: string | null,
): RawSiiAccountRow {
  return {
    sourceRowNumber: number,
    cells: [code, name],
    sourceColumns: { codigo: code, descripcion: name },
  };
}

function account(code: string): ValidatedSiiAccountRow {
  return {
    sourceRowNumber: 1,
    code,
    name: code,
    description: null,
    level: null,
    sourceColumns: {},
    sortOrder: 1,
    parentCode: null,
  };
}

describe("official SII account row pipeline", () => {
  it("preserves a valid code as trimmed text", () => {
    const result = validateRows(
      normalizeRows([row(3, " 1.01.25.00 ", " Caja ")]),
    );
    assert.equal(result.rows[0].code, "1.01.25.00");
    assert.equal(typeof result.rows[0].code, "string");
  });

  it("ignores headings and rejects codes outside the official format", () => {
    const result = validateRows(
      normalizeRows([
        row(3, null, "SECCIÓN I"),
        row(4, "Código ID Partida", "Descripción"),
        row(5, "101", "Caja"),
        row(6, "1.01.01.00", "Caja"),
      ]),
    );
    assert.deepEqual(
      result.rows.map((item) => item.code),
      ["1.01.01.00"],
    );
    assert.equal(result.ignoredRows, 3);
  });

  it("detects duplicate official codes", () => {
    const result = validateRows(
      normalizeRows([
        row(3, "1.01.01.00", "Caja"),
        row(4, "1.01.01.00", "Caja repetida"),
      ]),
    );
    assert.deepEqual(result.duplicateCodes, ["1.01.01.00"]);
  });

  it("derives levels and nearest existing ancestors from codes", () => {
    const result = resolveHierarchy([
      account("1.00.00.00"),
      account("1.01.00.00"),
      account("1.01.25.00"),
      account("5.01.05.06"),
    ]);
    assert.deepEqual(
      result.rows.map(({ level, parentCode }) => ({ level, parentCode })),
      [
        { level: 1, parentCode: null },
        { level: 2, parentCode: "1.00.00.00" },
        { level: 3, parentCode: "1.01.00.00" },
        { level: 4, parentCode: null },
      ],
    );
    assert.deepEqual(result.missingParents, ["5.01.05.06"]);
  });

  it("refuses the visual F1926 sheet", () => {
    assert.throws(
      () =>
        detectSheet(
          {
            workbook: { SheetNames: ["F1926"], Sheets: { F1926: {} } },
            sheets: ["F1926"],
            checksumInput: Buffer.alloc(1),
          },
          "F1926",
        ),
      /visual/,
    );
  });
});

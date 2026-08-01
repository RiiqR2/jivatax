import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseJournal } from "./journal-parser";

const columns = {
  date: 0,
  voucherNumber: 1,
  sequence: 2,
  accountCode: 3,
  debit: 4,
  credit: 5,
  description: 6,
};
const period = {
  commercialYear: 2025,
  startDate: "2025-01-01",
  endDate: "2025-12-31",
};

describe("parseJournal", () => {
  it("permite repetir una cuenta y cuadra cada comprobante", () => {
    const result = parseJournal({
      matrix: [
        [],
        ["2025-02-01", "0001", 1, "1.01", 100, 0, "Debe"],
        ["2025-02-01", "0001", 2, "1.01", 0, 100, "Haber"],
      ],
      headerRow: 0,
      columns,
      sheetName: "Diario",
      period,
    });
    assert.equal(result.errors.length, 0);
    assert.equal(result.rows[0].voucherNumber, "0001");
    assert.equal(result.details.balancedVoucherCount, 1);
    assert.equal(
      result.errors.some((error) => error.code === "DUPLICATE_ACCOUNT"),
      false,
    );
  });

  it("rechaza secuencia duplicada, comprobante descuadrado y fecha fuera del período", () => {
    const result = parseJournal({
      matrix: [
        [],
        ["2026-01-01", "1", 1, "01", 100, 0, "Uno"],
        ["2025-01-01", "1", 1, "01", 0, 50, "Dos"],
      ],
      headerRow: 0,
      columns,
      sheetName: "Diario",
      period,
    });
    assert.ok(
      result.errors.some(
        (error) => error.code === "DUPLICATE_VOUCHER_SEQUENCE",
      ),
    );
    assert.ok(
      result.errors.some((error) => error.code === "UNBALANCED_VOUCHER"),
    );
    assert.ok(
      result.errors.some(
        (error) => error.code === "DATE_OUTSIDE_COMMERCIAL_PERIOD",
      ),
    );
    for (const error of result.errors) {
      assert.equal(typeof error.sourceRowNumber, "number");
      assert.ok(error.field && error.code && error.message);
      assert.ok("rawValue" in error);
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGeneralLedger } from "./general-ledger-parser";

describe("parseGeneralLedger", () => {
  it("acepta 23 movimientos con cuentas repetidas y preserva códigos", () => {
    const header = [
      "Cuenta",
      "Nombre",
      "Fecha",
      "Tipo",
      "Número",
      "Glosa",
      "Debe",
      "Haber",
    ];
    const movements = Array.from({ length: 23 }, (_, index) => [
      ["1.01.001", "1.01.001", "1.02.001", "2.01.001"][index % 4],
      ["Banco Estado", "Banco Estado", "IVA Crédito Fiscal", "Proveedores"][
        index % 4
      ],
      new Date(Date.UTC(2025, index % 12, 1)),
      index % 2 ? "Factura" : "Boleta",
      String(index + 1).padStart(5, "0"),
      `Movimiento ${index + 1}`,
      index % 2 ? 0 : 100,
      index % 2 ? 100 : 0,
    ]);
    const result = parseGeneralLedger({
      matrix: [header, ...movements],
      headerRow: 0,
      columns: {
        accountCode: 0,
        accountName: 1,
        date: 2,
        documentType: 3,
        documentNumber: 4,
        description: 5,
        debit: 6,
        credit: 7,
      },
      sheetName: "Mayor",
      period: {
        commercialYear: 2025,
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      },
    });

    assert.equal(result.rows.length, 23);
    assert.equal(result.rows[0].accountCode, "1.01.001");
    assert.equal(result.rows[0].date, "2025-01-01");
    assert.equal(
      result.errors.some((error) => error.code === "DUPLICATE_ACCOUNT"),
      false,
    );
    assert.deepEqual(result.totals, { debit: 1200, credit: 1100 });
  });

  it("valida montos, fechas comerciales y movimientos de doble partida", () => {
    const result = parseGeneralLedger({
      matrix: [[], ["01", "Caja", "01/01/2026", "FAC", "1", "Glosa", 10, 20]],
      headerRow: 0,
      columns: {
        accountCode: 0,
        accountName: 1,
        date: 2,
        documentType: 3,
        documentNumber: 4,
        description: 5,
        debit: 6,
        credit: 7,
      },
      sheetName: "Mayor",
      period: {
        commercialYear: 2025,
        startDate: "2025-01-01",
        endDate: "2025-12-31",
      },
    });
    assert.ok(
      result.errors.some(
        (error) => error.code === "DATE_OUTSIDE_COMMERCIAL_PERIOD",
      ),
    );
    assert.ok(
      result.errors.some((error) => error.code === "BOTH_DEBIT_AND_CREDIT"),
    );
  });
});

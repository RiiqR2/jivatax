import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDemoDashboardData } from "../src/lib/demo-dashboard-data.ts";

describe("dashboard demo por empresa", () => {
  it("mantiene métricas determinísticas para la misma empresa", () => {
    assert.deepEqual(
      getDemoDashboardData("empresa-a"),
      getDemoDashboardData("empresa-a"),
    );
  });

  it("cambia las métricas al seleccionar otra empresa", () => {
    assert.notDeepEqual(
      getDemoDashboardData("empresa-a"),
      getDemoDashboardData("empresa-b"),
    );
  });
});

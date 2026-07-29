import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

describe("dashboard demo por empresa y período", () => {
  it("es estable para el mismo contexto y cambia entre períodos", () => {
    const first = getDemoDashboardData("empresa-a:periodo-1");
    const repeated = getDemoDashboardData("empresa-a:periodo-1");
    const anotherPeriod = getDemoDashboardData("empresa-a:periodo-2");

    assert.deepEqual(first, repeated);
    assert.notDeepEqual(first, anotherPeriod);
  });

  it("muestra gráficos, homologación, avance y actividad", () => {
    const source = readFileSync(
      new URL(
        "../src/components/accounting/period-dashboard.tsx",
        import.meta.url,
      ),
      "utf8",
    );

    assert.match(source, /Documentos procesados por mes/);
    assert.match(source, /Estado de homologación/);
    assert.match(source, /Avance del proceso tributario/);
    assert.match(source, /Actividad reciente/);
  });
});

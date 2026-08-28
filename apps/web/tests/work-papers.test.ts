import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  A17_MANUAL_FIELDS,
  CALCULATOR_NOT_IMPLEMENTED,
  EMPTY_APPLICABLE_MESSAGE,
  PROFESSIONAL_REVIEW_LABEL,
  canCalculateA17,
  hasExecutionHistory,
  isJobInProgress,
  isValidA17Decimal,
  jobStatusLabel,
  latestExecution,
  listPresentationStatus,
  parseResultSnapshot,
  requiresProfessionalReview,
  workPaperExecutionPath,
  workPapersPath,
} from "../src/lib/work-papers.ts";
import type { WorkPaperExecutionSummary } from "../src/types/work-papers.types.ts";
import { periodSelectionPath } from "../src/lib/accounting-navigation.ts";

function execution(
  id: string,
  status: "draft" | "finalized",
  revision: number,
): WorkPaperExecutionSummary {
  return {
    id,
    status,
    revision,
    supersedesExecutionId: revision > 1 ? "older" : null,
    finalizedAt: status === "finalized" ? "2026-08-01T00:00:00.000Z" : null,
  };
}

test("el listado distingue sin iniciar, borrador y finalizado", () => {
  assert.equal(listPresentationStatus([]).label, "Sin iniciar");
  assert.equal(
    listPresentationStatus([execution("d", "draft", 1)]).label,
    "Borrador",
  );
  assert.equal(
    listPresentationStatus([execution("f", "finalized", 1)]).label,
    "Finalizado",
  );
  assert.equal(
    latestExecution([
      execution("old", "finalized", 1),
      execution("new", "draft", 2),
    ])?.id,
    "new",
  );
  assert.equal(
    hasExecutionHistory([
      execution("old", "finalized", 1),
      execution("new", "draft", 2),
    ]),
    true,
  );
});

test("solo A.17 draft habilita cálculo", () => {
  assert.equal(
    canCalculateA17({ definitionCode: "A.17", status: "draft" }),
    true,
  );
  assert.equal(
    canCalculateA17({ definitionCode: "A.17", status: "finalized" }),
    false,
  );
  for (const code of ["A.5", "A.10", "A.11", "A.19"]) {
    assert.equal(
      canCalculateA17({ definitionCode: code, status: "draft" }),
      false,
    );
  }
});

test("expone missingInputs, reconciliaciones y revisión profesional", () => {
  assert.match(
    EMPTY_APPLICABLE_MESSAGE,
    /No se detectaron papeles de trabajo para las homologaciones confirmadas/,
  );
  assert.equal(CALCULATOR_NOT_IMPLEMENTED, "Cálculo aún no implementado");
  assert.equal(PROFESSIONAL_REVIEW_LABEL, "Requiere revisión profesional");
  const snapshot = parseResultSnapshot({
    missingInputs: ["LEASE_PAYMENTS"],
    warnings: ["no cuadra"],
    reconciliations: [
      {
        key: "LEASE_LIABILITY",
        calculatedAmount: "1",
        reportedAmount: "2",
        difference: "-1",
        status: "warning",
        messages: ["diferencia"],
      },
    ],
    calculatedValues: { requiresProfessionalReview: true },
  });
  assert.deepEqual(snapshot.missingInputs, ["LEASE_PAYMENTS"]);
  assert.equal(snapshot.reconciliations[0].status, "warning");
  assert.equal(requiresProfessionalReview(snapshot), true);
  assert.equal(isValidA17Decimal("10.2500"), true);
  assert.equal(isValidA17Decimal("10.12345"), false);
  assert.ok(
    A17_MANUAL_FIELDS.some((field) => field.inputKey === "LEASE_PAYMENTS"),
  );
});

test("job helpers y polling se detienen en completed/failed", () => {
  assert.equal(isJobInProgress("pending"), true);
  assert.equal(isJobInProgress("running"), true);
  assert.equal(isJobInProgress("completed"), false);
  assert.equal(isJobInProgress("failed"), false);
  assert.equal(jobStatusLabel("pending"), "Pendiente");
  assert.equal(jobStatusLabel("running"), "Procesando");
});

test("el listado y el detalle cubren empty state, cuentas, crear y abrir", () => {
  const list = readFileSync(
    new URL(
      "../src/components/work-papers/work-papers-list.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const detail = readFileSync(
    new URL(
      "../src/components/work-papers/work-paper-execution-detail.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const form = readFileSync(
    new URL(
      "../src/components/work-papers/a17-calculate-form.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const service = readFileSync(
    new URL("../src/services/work-papers.service.ts", import.meta.url),
    "utf8",
  );

  const summary = readFileSync(
    new URL(
      "../src/components/work-papers/work-papers-summary.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(list, /EMPTY_APPLICABLE_MESSAGE/);
  assert.match(list, /Crear papel/);
  assert.match(list, /Abrir/);
  assert.match(list, /companyAccountCode/);
  assert.match(list, /siiAccountCode/);
  assert.match(list, /definitionId/);
  assert.doesNotMatch(list, /calculatorKey/);
  assert.doesNotMatch(list, /Fila fuente/);
  assert.doesNotMatch(list, /formatRationale/);
  assert.match(list, /CALCULATOR_NOT_IMPLEMENTED/);
  assert.match(list, /WorkPapersSummaryTable/);

  assert.match(detail, /canCalculateA17/);
  assert.match(detail, /Antecedentes pendientes/);
  assert.match(detail, /PROFESSIONAL_REVIEW_LABEL/);
  assert.match(detail, /A17CalculateForm/);
  assert.match(detail, /CALCULATOR_NOT_IMPLEMENTED/);
  assert.match(detail, /refetchInterval/);
  assert.match(detail, /isJobInProgress/);
  assert.doesNotMatch(detail, /Fila fuente/);
  assert.doesNotMatch(detail, /formatRationale/);

  assert.match(summary, /Resumen de Papeles de Trabajo/);
  assert.match(summary, /refetchInterval/);
  assert.match(summary, /isJobInProgress/);

  assert.match(form, /Calcular/);
  assert.match(service, /payload = \{ definitionId \}/);
  assert.match(service, /manualInputs:/);
  assert.match(service, /\/calculations/);
  assert.match(service, /\/summary/);
  assert.match(service, /\/jobs\//);
  assert.doesNotMatch(service, /\.\.\.dto|\.\.\.values/);
});

test("navegación operativa incluye papeles de trabajo por período", () => {
  assert.equal(
    workPapersPath("company-1", "period-1"),
    "/companies/company-1/periods/period-1/work-papers",
  );
  assert.equal(
    workPaperExecutionPath("company-1", "period-1", "exec-1"),
    "/companies/company-1/periods/period-1/work-papers/executions/exec-1",
  );
  assert.equal(
    periodSelectionPath(
      "/companies/company-1/periods/old/work-papers",
      "company-1",
      "new",
    ),
    "/companies/company-1/periods/new/work-papers",
  );
  assert.equal(
    periodSelectionPath(
      "/companies/company-1/periods/old/work-papers/executions/exec-1",
      "company-1",
      "new",
    ),
    "/companies/company-1/periods/new/work-papers",
  );

  const sidebar = readFileSync(
    new URL("../src/components/layout/app-sidebar.tsx", import.meta.url),
    "utf8",
  );
  assert.match(sidebar, /label: "Papeles de trabajo"/);
  assert.match(sidebar, /work-papers/);
  assert.doesNotMatch(sidebar, /\/admin\/work-papers/);
});

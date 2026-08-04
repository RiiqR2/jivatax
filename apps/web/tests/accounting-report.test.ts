import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canReviewMappings,
  displayRawValue,
  fieldLabel,
  groupIssues,
  statusPresentation,
} from "../src/lib/accounting-presentation.ts";

const reportSource = readFileSync(
  new URL(
    "../src/components/accounting/document-report-page.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("traduce estados y campos contables y presenta valores vacíos", () => {
  assert.equal(statusPresentation("invalid").label, "Inválido");
  assert.equal(statusPresentation("processed").variant, "success");
  assert.equal(fieldLabel("debitBalance"), "Saldo deudor");
  assert.equal(fieldLabel("accountCode"), "Código cuenta");
  assert.equal(displayRawValue(null), "Vacío");
  assert.equal(displayRawValue(""), "Vacío");
});

test("agrupa errores por código y campo", () => {
  const groups = groupIssues([
    {
      sourceRowNumber: 2,
      field: "assets",
      code: "REQUIRED_FIELD",
      message: "Vacío",
      rawValue: null,
    },
    {
      sourceRowNumber: 3,
      field: "assets",
      code: "REQUIRED_FIELD",
      message: "Vacío",
      rawValue: null,
    },
    {
      sourceRowNumber: 3,
      field: "liabilities",
      code: "REQUIRED_FIELD",
      message: "Vacío",
      rawValue: null,
    },
  ]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].fields, [
    { field: "assets", count: 2 },
    { field: "liabilities", count: 1 },
  ]);
});

test("solo habilita homologación para Balance procesado con filas válidas", () => {
  assert.equal(
    canReviewMappings("balance", "processed", { validRows: 2 }),
    true,
  );
  assert.equal(
    canReviewMappings("balance", "invalid", { validRows: 2 }),
    false,
  );
  assert.equal(
    canReviewMappings("balance", "processed", { validRows: 0 }),
    false,
  );
  assert.equal(
    canReviewMappings("journal", "processed", { validRows: 2 }),
    false,
  );
});

test("historial navega a páginas frontend y no usa alert ni endpoint JSON directo", () => {
  const source = readFileSync(
    new URL("../src/components/accounting/documents-page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /documents\/\$\{document\.id\}\/report/);
  assert.doesNotMatch(
    source,
    /window\.alert|console\.log|JSON\.stringify\(report/,
  );
});

test("reporte ofrece resumen, tabla, paginación y descarga JSON", () => {
  const source = readFileSync(
    new URL(
      "../src/components/accounting/document-report-page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /Reporte de validación/);
  assert.match(source, /Errores agrupados/);
  assert.match(source, /<table/);
  assert.match(source, /\[25, 50, 100\]/);
  assert.match(source, /new Blob/);
});

test("reporte de Balance separa totales informados, recalculados y diferencias", () => {
  assert.match(reportSource, /Totales informados por la empresa/);
  assert.match(reportSource, /Totales recalculados por JivaTax/);
  assert.match(reportSource, /title="Diferencia"/);
  assert.match(reportSource, /Los totales informados coinciden/);
  assert.match(reportSource, /JivaTax no modificará los valores entregados/);
  assert.match(reportSource, /const grouped = integer\.replace/);
});

test("homologación tiene vacío, filtros, búsqueda, confirmación e historial", () => {
  const source = readFileSync(
    new URL(
      "../src/components/accounting/account-mapping-page.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /No existen cuentas para homologar/);
  assert.match(source, /Pendientes/);
  assert.match(source, /Buscar por código/);
  assert.match(source, /Confirmar homologación/);
  assert.match(source, /mappingHistory/);
  assert.match(source, /No existen sugerencias con los filtros seleccionados/);
  assert.match(source, /Aprobar seleccionadas/);
  assert.match(source, /Aprobar sugerencias de alta confianza/);
  assert.match(source, /Seleccionar todas las sugerencias visibles/);
  assert.match(source, /context\.company\.legalName/);
  assert.match(source, /Nombre observado/);
  assert.match(source, /Nombre registrado inicialmente/);
  assert.doesNotMatch(source, /Nombre histórico/);
  assert.doesNotMatch(source, /Nombre modificado · Canónico/);
  assert.doesNotMatch(
    source,
    /window\.(?:alert|confirm|prompt)|\b(?:alert|confirm|prompt)\(/,
  );
  assert.match(source, /aria-labelledby="approval-title"/);
  assert.match(source, /aria-describedby="approval-description"/);
  assert.match(source, /Aprobando…/);
  assert.match(source, /No fue posible aprobar\. La selección se mantuvo/);
  assert.match(source, /onCancel=\{\(event\) => \{[\s\S]*if \(loading\)/);
  assert.match(source, /Los mappings ya confirmados no serán reemplazados/);
  assert.match(source, /Confirmar rechazo/);
});

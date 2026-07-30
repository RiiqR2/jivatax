import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  companyEntryPath,
  periodSelectionPath,
  selectPreferredPeriod,
} from "../src/lib/accounting-navigation.ts";
import type { TaxPeriod } from "../src/types/accounting.types.ts";

function period(id: string, taxYear: number, isActive: boolean): TaxPeriod {
  return {
    id,
    companyId: "company-1",
    commercialYear: taxYear - 1,
    taxYear,
    status: "open",
    startDate: `${taxYear - 1}-01-01`,
    endDate: `${taxYear - 1}-12-31`,
    isActive,
  };
}

test("resuelve el período activo y no reutiliza uno de otra empresa", () => {
  const periods = [period("old", 2025, false), period("active", 2026, true)];

  assert.equal(selectPreferredPeriod(periods)?.id, "active");
  assert.equal(
    companyEntryPath("company-2", periods),
    "/companies/company-2/periods/active/dashboard",
  );
});

test("usa el período más reciente cuando no hay uno activo", () => {
  const periods = [period("old", 2025, false), period("recent", 2027, false)];

  assert.equal(selectPreferredPeriod(periods)?.id, "recent");
});

test("una empresa sin períodos conduce al setup", () => {
  assert.equal(
    companyEntryPath("company-1", []),
    "/companies/company-1/periods/setup",
  );
  assert.equal(
    companyEntryPath("company-1", [], "documents"),
    "/companies/company-1/periods/setup",
  );
});

test("cambiar período conserva secciones tributarias pero no anida Usuarios", () => {
  assert.equal(
    periodSelectionPath(
      "/companies/company-1/periods/old/documents",
      "company-1",
      "new",
    ),
    "/companies/company-1/periods/new/documents",
  );
  assert.equal(
    periodSelectionPath("/companies/company-1/users", "company-1", "new"),
    "/companies/company-1/users",
  );
});

test("el sidebar conserva operación sin período y limita Administración a metauser", () => {
  const sidebar = readFileSync(
    new URL("../src/components/layout/app-sidebar.tsx", import.meta.url),
    "utf8",
  );

  assert.match(sidebar, /label: "Resumen"/);
  assert.match(sidebar, /label: "Documentos"/);
  assert.match(sidebar, /label: "Homologación"/);
  assert.match(sidebar, /account-mapping/);
  assert.match(sidebar, /label: "Usuarios"/);
  assert.match(sidebar, /Crea un período tributario para cargar documentos/);
  assert.match(sidebar, /platformRole === "metauser"/);
});

test("la creación del primer período navega al dashboard canónico", () => {
  const setup = readFileSync(
    new URL(
      "../src/components/accounting/tax-period-setup.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    setup,
    /`\/companies\/\$\{companyId\}\/periods\/\$\{period\.id\}\/dashboard`/,
  );
});

test("la raíz resuelve el contexto operativo sin redirigir metausers a admin", () => {
  const home = readFileSync(
    new URL("../src/app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(home, /companyEntryPath/);
  assert.doesNotMatch(home, /router\.(push|replace)\("\/admin"/);
});

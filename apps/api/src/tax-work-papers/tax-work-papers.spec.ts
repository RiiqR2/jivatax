import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { getMetadataArgsStorage } from "typeorm";
import {
  TaxWorkPaperCalculatorRegistry,
  type TaxWorkPaperCalculator,
} from "./contracts/tax-work-paper-calculator";
import { TaxAdjustmentEntity } from "./entities/tax-adjustment.entity";
import { WorkPaperApplicabilityEntity } from "./entities/work-paper-applicability.entity";
import { WorkPaperDefinitionEntity } from "./entities/work-paper-definition.entity";
import { WorkPaperDependencyEntity } from "./entities/work-paper-dependency.entity";
import { WorkPaperExecutionEntity } from "./entities/work-paper-execution.entity";

describe("tax work paper framework", () => {
  it("versions definitions and execution revisions with composite uniqueness", () => {
    const indices = getMetadataArgsStorage().indices.filter(
      (index) =>
        index.target === WorkPaperDefinitionEntity ||
        index.target === WorkPaperExecutionEntity,
    );
    assert.ok(
      indices.some(
        (index) =>
          index.unique && JSON.stringify(index.columns).includes("version"),
      ),
    );
    assert.ok(
      indices.some(
        (index) =>
          index.unique && JSON.stringify(index.columns).includes("revision"),
      ),
    );
  });
  it("models N:M applicability with a reusable account role", () => {
    const columns = getMetadataArgsStorage()
      .columns.filter(
        (column) => column.target === WorkPaperApplicabilityEntity,
      )
      .map((column) => column.propertyName);
    assert.deepEqual(
      ["definitionId", "siiAccountId", "roleKey"].every((key) =>
        columns.includes(key),
      ),
      true,
    );
  });
  it("ties normalized adjustments to company, period and execution", () => {
    const columns = getMetadataArgsStorage()
      .columns.filter((column) => column.target === TaxAdjustmentEntity)
      .map((column) => column.propertyName);
    assert.deepEqual(
      [
        "companyId",
        "taxPeriodId",
        "executionId",
        "type",
        "amount",
        "ruleKey",
        "revision",
      ].every((key) => columns.includes(key)),
      true,
    );
  });
  it("prevents trivial self-dependencies at persistence level", () => {
    const migration = readFileSync(
      "src/database/migrations/1785042000000-create-tax-work-papers.ts",
      "utf8",
    );
    assert.match(
      migration,
      /CHECK \(execution_id <> depends_on_execution_id\)/,
    );
    assert.ok(
      getMetadataArgsStorage().tables.some(
        (table) => table.target === WorkPaperDependencyEntity,
      ),
    );
  });
  it("seeds all A.1-A.20 definitions without applicability guesses", () => {
    const migration = readFileSync(
      "src/database/migrations/1785042000000-create-tax-work-papers.ts",
      "utf8",
    );
    assert.match(migration, /Pérdida Tributaria/);
    assert.match(migration, /names\.length/);
    assert.doesNotMatch(
      migration,
      /INSERT INTO tax_work_paper_applicabilities/,
    );
  });
  it("detects only confirmed mappings and does not mutate mappings or auto-execute", () => {
    const service = readFileSync(
      "src/tax-work-papers/tax-work-papers.service.ts",
      "utf8",
    );
    const detection = service.slice(
      service.indexOf("async detectApplicable"),
      service.indexOf("async createDraft"),
    );
    assert.match(detection, /CompanyAccountMappingStatus\.CONFIRMED/);
    assert.doesNotMatch(detection, /\.save\(|\.update\(|\.insert\(/);
  });
  it("requires explicit succession and preserves finalized execution history", () => {
    const service = readFileSync(
      "src/tax-work-papers/tax-work-papers.service.ts",
      "utf8",
    );
    assert.match(
      service,
      /Solo una ejecución finalizada puede originar una nueva revisión/,
    );
    assert.match(
      service,
      /Indica explícitamente la ejecución finalizada que será sucedida/,
    );
    assert.doesNotMatch(service, /executions\.remove|executions\.delete/);
  });
  it("supports deterministic calculator registration by definition version", () => {
    const registry = new TaxWorkPaperCalculatorRegistry();
    const calculator = {
      definitionCode: "A.17",
      definitionVersion: 1,
      calculate: async () => ({
        inputsUsed: [],
        calculatedValues: {},
        warnings: [],
        missingInputs: [],
        taxAdjustments: [],
        evidence: [],
      }),
    } satisfies TaxWorkPaperCalculator;
    registry.register(calculator);
    assert.equal(registry.get("A.17", 1), calculator);
    assert.throws(() => registry.register(calculator), /already registered/);
  });
});

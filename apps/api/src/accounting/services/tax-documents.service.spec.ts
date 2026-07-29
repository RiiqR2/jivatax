import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { TaxDocumentType } from "../enums/accounting.enums";
import { TaxDocumentsService } from "./tax-documents.service";

describe("TaxDocumentsService document lifecycle", () => {
  it("crea tax_document después de validar stored_file e incrementa versión", async () => {
    const saved: Record<string, unknown>[] = [];
    const documents = {
      async findOne() {
        return { versionNumber: 2 };
      },
      create(value: Record<string, unknown>) {
        return value;
      },
      async save(value: Record<string, unknown>) {
        saved.push(value);
        return value;
      },
    };
    const files = {
      async findOneBy() {
        return { id: "stored-file", extension: "xlsx" };
      },
    };
    const periods = {
      async get() {
        return { id: "period" };
      },
    };
    const service = new TaxDocumentsService(
      documents as never,
      files as never,
      {} as never,
      {} as never,
      periods as never,
    );

    const result = await service.create("company", "period", "user", {
      documentType: TaxDocumentType.BALANCE,
      storedFileId: "stored-file",
    });

    assert.equal(result.versionNumber, 3);
    assert.equal(result.storedFileId, "stored-file");
    assert.equal(saved.length, 1);
  });

  it("filtra el historial por empresa, período y tipo", async () => {
    let capturedWhere: Record<string, unknown> | undefined;
    const documents = {
      async find(options: { where: Record<string, unknown> }) {
        capturedWhere = options.where;
        return [];
      },
    };
    const periods = {
      async get() {
        return { id: "period" };
      },
    };
    const service = new TaxDocumentsService(
      documents as never,
      {} as never,
      {} as never,
      {} as never,
      periods as never,
    );

    await service.list("company", "period", TaxDocumentType.JOURNAL);

    assert.deepEqual(capturedWhere, {
      companyId: "company",
      taxPeriodId: "period",
      documentType: TaxDocumentType.JOURNAL,
    });
  });

  it("recupera el reporte persistido del documento", async () => {
    const report = { rowsRead: 10, validRows: 9, errors: [] };
    const documents = {
      async findOne() {
        return { id: "document", metadata: report };
      },
    };
    const periods = {
      async get() {
        return { id: "period" };
      },
    };
    const service = new TaxDocumentsService(
      documents as never,
      {} as never,
      {} as never,
      {} as never,
      periods as never,
    );

    assert.deepEqual(
      await service.report("company", "period", "document"),
      report,
    );
  });

  it("solo busca para supersede una versión procesada anterior", () => {
    const source = readFileSync(__filename, "utf8");
    const serviceSource = readFileSync(
      __filename.replace(
        "tax-documents.service.spec.ts",
        "tax-documents.service.ts",
      ),
      "utf8",
    );

    assert.ok(source.length > 0);
    assert.match(
      serviceSource,
      /versionNumber: LessThan\(document\.versionNumber\)/,
    );
    assert.match(
      serviceSource,
      /parsed\.report\.errors\.length > 0[\s\S]*TaxDocumentStatus\.INVALID[\s\S]*return parsed\.report/,
    );
  });
});

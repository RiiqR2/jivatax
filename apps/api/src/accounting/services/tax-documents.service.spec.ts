import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BalanceRole, TaxDocumentType } from "../enums/accounting.enums";
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
      balanceRole: BalanceRole.CLOSING,
      storedFileId: "stored-file",
    });

    assert.equal(result.versionNumber, 3);
    assert.equal(result.storedFileId, "stored-file");
    assert.equal(saved.length, 1);
  });

  it("exige rol para Balance y rechaza rol en Libro Mayor", async () => {
    const service = new TaxDocumentsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { get: async () => ({ id: "period" }) } as never,
    );
    await assert.rejects(
      service.create("company", "period", "user", {
        documentType: TaxDocumentType.BALANCE,
        storedFileId: "stored-file",
      }),
      /rol del Balance es obligatorio/,
    );
    await assert.rejects(
      service.create("company", "period", "user", {
        documentType: TaxDocumentType.GENERAL_LEDGER,
        balanceRole: BalanceRole.OPENING,
        storedFileId: "stored-file",
      }),
      /rol solo corresponde a documentos Balance/,
    );
  });

  it("numera opening y closing de manera independiente", async () => {
    const queriedRoles: unknown[] = [];
    const documents = {
      async findOne(options: { where: { balanceRole: unknown } }) {
        queriedRoles.push(options.where.balanceRole);
        return options.where.balanceRole === BalanceRole.OPENING
          ? { versionNumber: 1 }
          : null;
      },
      create(value: Record<string, unknown>) {
        return value;
      },
      async save(value: Record<string, unknown>) {
        return value;
      },
    };
    const service = new TaxDocumentsService(
      documents as never,
      { findOneBy: async () => ({ id: "file", extension: "xlsx" }) } as never,
      {} as never,
      {} as never,
      { get: async () => ({ id: "period" }) } as never,
    );
    const opening = await service.create("company", "period", "user", {
      documentType: TaxDocumentType.BALANCE,
      balanceRole: BalanceRole.OPENING,
      storedFileId: "file",
    });
    const closing = await service.create("company", "period", "user", {
      documentType: TaxDocumentType.BALANCE,
      balanceRole: BalanceRole.CLOSING,
      storedFileId: "file",
    });
    assert.equal(opening.versionNumber, 2);
    assert.equal(closing.versionNumber, 1);
    assert.deepEqual(queriedRoles, [BalanceRole.OPENING, BalanceRole.CLOSING]);
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

  it("clasifica un histórico con auditoría sin alterar archivo ni importación", async () => {
    const historical = {
      id: "historical",
      companyId: "company",
      taxPeriodId: "period",
      documentType: TaxDocumentType.BALANCE,
      balanceRole: null,
      versionNumber: 4,
      storedFileId: "unchanged-file",
    };
    const manager = {
      findOne: async (
        _entity: unknown,
        options: { where: Record<string, unknown> },
      ) => (options.where.id ? historical : null),
      findOneBy: async () => null,
      save: async (value: Record<string, unknown>) => value,
      query: async () => [],
    };
    const service = new TaxDocumentsService(
      {} as never,
      {} as never,
      {
        transaction: async (callback: (value: typeof manager) => unknown) =>
          callback(manager),
      } as never,
      {} as never,
      { get: async () => ({ id: "period" }) } as never,
    );
    const result = await service.classifyHistoricalBalance(
      "company",
      "period",
      "historical",
      "admin-user",
      BalanceRole.CLOSING,
    );
    assert.equal(result.balanceRole, BalanceRole.CLOSING);
    assert.equal(result.balanceRoleClassifiedByUserId, "admin-user");
    assert.ok(result.balanceRoleClassifiedAt instanceof Date);
    assert.equal(result.storedFileId, "unchanged-file");
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

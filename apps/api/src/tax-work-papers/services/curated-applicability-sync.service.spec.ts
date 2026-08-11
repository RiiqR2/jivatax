import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { APPLICABILITY_ONLY_ROLE } from "../data/compile-curated-applicability";
import { CURATED_APPLICABILITY_SOURCE_ROWS } from "../data/curated-applicability-matrix";
import { CuratedApplicabilitySyncService } from "./curated-applicability-sync.service";

describe("CuratedApplicabilitySyncService", () => {
  it("inserts missing associations idempotently and never deletes history", async () => {
    const existing = {
      id: "existing",
      definitionId: "def-a1",
      siiAccountCode: "1.01.20.00",
      roleKey: APPLICABILITY_ONLY_ROLE,
      rationale: "old",
      isActive: true,
      deletedAt: null,
    };
    const saved: unknown[] = [];
    const repository = {
      findOne: async ({
        where,
        withDeleted,
      }: {
        where: {
          definitionId: string;
          siiAccountCode: string;
          roleKey: string;
        };
        withDeleted?: boolean;
      }) => {
        assert.equal(withDeleted, true);
        if (
          where.definitionId === "def-a1" &&
          where.siiAccountCode === "1.01.20.00"
        )
          return existing;
        return null;
      },
      create: (value: unknown) => value,
      save: async (value: unknown) => {
        saved.push(value);
        return value;
      },
    };
    const catalogCodes = CURATED_APPLICABILITY_SOURCE_ROWS.filter((row) =>
      /^A\.(1|17)$/i.test(row.workPaperCode.trim()),
    ).map((row) => ({ code: row.siiAccountCode.trim() }));
    const qb: Record<string, unknown> = {};
    qb.innerJoin = () => qb;
    qb.select = () => qb;
    qb.where = () => qb;
    qb.getRawMany = async () => catalogCodes;

    const service = new CuratedApplicabilitySyncService(
      {
        createQueryBuilder: () => qb,
        transaction: async (fn: (manager: unknown) => Promise<void>) =>
          fn({ getRepository: () => repository }),
      } as never,
      {
        find: async () => [
          { id: "def-a1", code: "A.1" },
          { id: "def-a17", code: "A.17" },
        ],
      } as never,
      {} as never,
    );

    const result = await service.synchronize();
    assert.equal(result.inserted, 3);
    assert.equal(result.unchanged, 1);
    assert.ok(
      saved.every(
        (row) =>
          typeof row === "object" &&
          row != null &&
          (row as { roleKey: string }).roleKey === APPLICABILITY_ONLY_ROLE,
      ),
    );
    assert.doesNotMatch(JSON.stringify(saved), /LEASE_LIABILITY/);
    assert.ok(
      result.report.validAssociations.every((row) =>
        ["A.1", "A.17"].includes(row.workPaperCode),
      ),
    );
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DataSource } from "typeorm";
import { CompanyAccountMappingStatus } from "../../company-account-plan/enums/company-account-plan.enums";
import type { CurrentSiiAccountCatalogService } from "../../sii-account-plan/services/current-sii-account-catalog.service";
import { MatchingResolutionContextFactoryService } from "./matching-resolution-context-factory.service";
import { SiiAccountMatchingV2EvaluationService } from "./sii-account-matching-v2-evaluation.service";
import type { SiiAccountMatchingPipelineService } from "../pipeline/sii-account-matching-pipeline.service";

const request = {
  companyId: "c1",
  taxPeriodId: "p1",
  companyAccountId: "a1",
  balanceImportId: "b2",
};
const sii = { id: "s1", code: "1101", name: "Caja", parentId: null, level: 2 };

function fixture(overrides: Record<string, unknown> = {}) {
  const rows: Record<string, unknown> = {
    CompanyAccountEntity: { id: "a1", companyId: "c1" },
    TaxPeriodEntity: { id: "p1", companyId: "c1" },
    CompanyEntity: { id: "c1", industryId: "industry-1" },
    TaxDocumentEntity: {
      id: "b2",
      companyId: "c1",
      taxPeriodId: "p1",
      discardedAt: null,
    },
    TaxPeriodCompanyAccountEntity: {
      sourceDocumentId: "b2",
      accountCodeSnapshot: "1.01",
      accountNameSnapshot: "Caja balance 2",
      assetAmount: "10",
      liabilityAmount: "20",
      lossAmount: "30",
      gainAmount: "40",
      debitBalance: "50",
      creditBalance: "60",
      debitAmount: "70",
      creditAmount: "80",
    },
    CompanyAccountMappingEntity: null,
    CompanyAccountMappingHistoryEntity: [],
    SiiAccountTermEntity: [],
    ...overrides,
  };
  const manager = {
    getRepository(target: { name: string }) {
      return {
        findOneBy: async () => rows[target.name],
        findOne: async () => rows[target.name],
        find: async () => rows[target.name],
      };
    },
  };
  const dataSource = { manager } as unknown as DataSource;
  const catalog = {
    findAccounts: async () => [sii],
  } as unknown as CurrentSiiAccountCatalogService;
  return new MatchingResolutionContextFactoryService(dataSource, catalog);
}

describe("MatchingResolutionContextFactoryService", () => {
  it("uses exactly the requested balance snapshot and maps every real amount", async () => {
    const result = await fixture().create(request);
    assert.deepEqual(result.accountObservation, {
      accountCode: "1.01",
      accountName: "Caja balance 2",
      assetAmount: "10",
      liabilityAmount: "20",
      lossAmount: "30",
      gainAmount: "40",
      debitBalance: "50",
      creditBalance: "60",
      debits: "70",
      credits: "80",
    });
    assert.equal(result.industryId, "industry-1");
  });

  it("accepts confirmed only, filters history and aliases, and preserves negative evidence", async () => {
    const confirmed = {
      companyAccountId: "a1",
      status: CompanyAccountMappingStatus.CONFIRMED,
      siiAccount: sii,
      reviewedAt: new Date("2026-01-01"),
      mappingMethod: "manual",
      updatedAt: new Date(),
    };
    const old = { id: "old", code: "999", name: "Old" };
    const term = (values: Record<string, unknown>) => ({
      siiAccountId: "s1",
      siiAccount: sii,
      normalizedTerm: "caja",
      type: "alias",
      scope: "company",
      companyId: "c1",
      active: true,
      ...values,
    });
    const result = await fixture({
      CompanyAccountMappingEntity: confirmed,
      CompanyAccountMappingHistoryEntity: [
        {
          companyAccountId: "a1",
          newSiiAccountId: "s1",
          newSiiAccount: sii,
          createdAt: new Date(),
          reason: null,
        },
        {
          companyAccountId: "a1",
          newSiiAccountId: "old",
          newSiiAccount: old,
          createdAt: new Date(),
          reason: "user",
        },
      ],
      SiiAccountTermEntity: [
        term({}),
        term({ companyId: "c2" }),
        term({ active: false }),
        term({
          type: "negative_term",
          scope: "global",
          companyId: null,
          normalizedTerm: "no caja",
        }),
      ],
    }).create(request);
    assert.equal(result.confirmedMapping?.siiCode, "1101");
    assert.deepEqual(
      result.historicalCompanyMappings.map((x) => x.siiCode),
      ["999"],
    );
    assert.equal(result.companyAliases.length, 1);
    assert.equal(result.catalogTerms[0]?.type, "negative_term");
  });

  it("does not expose a pending mapping and rejects crossed tenancy contexts", async () => {
    const pending = {
      status: CompanyAccountMappingStatus.PENDING,
      siiAccount: sii,
    };
    assert.equal(
      (await fixture({ CompanyAccountMappingEntity: pending }).create(request))
        .confirmedMapping,
      undefined,
    );
    await assert.rejects(
      () => fixture({ CompanyAccountEntity: null }).create(request),
      /outside company context/,
    );
    await assert.rejects(
      () => fixture({ TaxPeriodEntity: null }).create(request),
      /outside company context/,
    );
    await assert.rejects(
      () => fixture({ TaxDocumentEntity: null }).create(request),
      /outside period context/,
    );
  });
});

describe("SiiAccountMatchingV2EvaluationService", () => {
  it("only creates context and resolves it, without a persistence operation", async () => {
    let creates = 0;
    let resolves = 0;
    const contexts = {
      create: async () => {
        creates++;
        return { marker: true };
      },
    };
    const pipeline = {
      resolve: (value: unknown) => {
        resolves++;
        assert.deepEqual(value, { marker: true });
        return { decision: "no_candidate" };
      },
    };
    const result = await new SiiAccountMatchingV2EvaluationService(
      contexts as never,
      pipeline as unknown as SiiAccountMatchingPipelineService,
    ).evaluate(request);
    assert.equal(creates, 1);
    assert.equal(resolves, 1);
    assert.equal(result.decision, "no_candidate");
  });
});

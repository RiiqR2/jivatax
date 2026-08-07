import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountMatchingShadowComparisonService } from "./account-matching-shadow-comparison.service";

const observation = (code: string) => ({
  accountCode: code,
  accountName: `Account ${code}`,
});

describe("AccountMatchingShadowComparisonService", () => {
  it("compares stable codes and covers missing-result categories without writes", async () => {
    const contexts = ["same", "different", "v7", "v2", "none", "confirmed"].map(
      (id) => ({
        companyId: "company",
        companyAccountId: id,
        accountObservation: observation(id),
        historicalCompanyMappings: [],
        companyAliases: [],
        catalogTerms: [],
        catalogAccounts: [],
      }),
    );
    const diagnostics = [
      {
        companyAccountId: "same",
        candidates: [{ siiAccountId: "old-uuid", code: "1101", name: "Cash" }],
        decision: "automatic",
        decisionReason: "automatic",
      },
      {
        companyAccountId: "different",
        candidates: [{ code: "2101", name: "Payables" }],
        decision: "automatic",
        decisionReason: "automatic",
      },
      {
        companyAccountId: "v7",
        candidates: [{ code: "3101", name: "Equity" }],
        decision: "automatic",
        decisionReason: "automatic",
      },
    ];
    const repository = { find: async () => diagnostics };
    const dataSource = {
      manager: { getRepository: () => repository },
    };
    const factory = { createBatch: async () => contexts };
    const winners: Record<
      string,
      { code: string; confirmed?: boolean } | undefined
    > = {
      same: { code: "1101" },
      different: { code: "2201" },
      v2: { code: "4101" },
      confirmed: { code: "5101", confirmed: true },
    };
    const pipeline = {
      resolve: (context: { companyAccountId: string }) => {
        const winner = winners[context.companyAccountId];
        return {
          decision: winner ? "strong" : "no_candidate",
          resolutionStatus: winner ? "resolved" : "no_candidate",
          warnings: [],
          autoConfirmed: false,
          candidates: winner
            ? [
                {
                  siiAccountId: `new-${winner.code}`,
                  siiCode: winner.code,
                  siiName: winner.code,
                  resolutionType: "ranked",
                  recommendationLevel: "strong",
                  evidence: [],
                  warnings: [],
                  reusedConfirmedMapping: winner.confirmed,
                },
              ]
            : [],
        };
      },
    };
    const classifier = {
      classify: (input: Record<string, unknown>) => ({
        ...input,
        observedSection: "asset",
        balanceNature: "debit",
        accountFamily: "cash",
        classificationWarnings: [],
      }),
    };
    const service = new AccountMatchingShadowComparisonService(
      dataSource as never,
      factory as never,
      pipeline as never,
      classifier as never,
    );

    const report = await service.compare({
      companyId: "company",
      taxPeriodId: "period",
      balanceImportId: "balance",
    });

    assert.equal(
      report.accounts.find((x) => x.companyAccountId === "same")?.comparison
        .sameWinner,
      true,
    );
    assert.equal(
      report.accounts.find((x) => x.companyAccountId === "different")
        ?.comparison.differentWinner,
      true,
    );
    assert.equal(
      report.accounts.find((x) => x.companyAccountId === "v7")?.comparison
        .v7Only,
      true,
    );
    assert.equal(
      report.accounts.find((x) => x.companyAccountId === "v2")?.comparison
        .v2Only,
      true,
    );
    assert.equal(
      report.accounts.find((x) => x.companyAccountId === "none")?.comparison
        .bothNoCandidate,
      true,
    );
    assert.deepEqual(
      report.accounts.find((x) => x.companyAccountId === "none")?.v7,
      { available: false },
    );
    assert.equal(
      report.accounts.find((x) => x.companyAccountId === "confirmed")
        ?.comparison.confirmedMappingReused,
      true,
    );
    assert.deepEqual(report.summary, {
      totalAccounts: 6,
      sameWinner: 1,
      differentWinner: 1,
      v7Only: 1,
      v2Only: 2,
      bothNoCandidate: 1,
      confirmedMappingsReused: 1,
      v2Strong: 4,
      v2Probable: 0,
      v2Weak: 0,
      v2Ambiguous: 0,
      v2NoCandidate: 2,
    });
    assert.ok(JSON.parse(JSON.stringify(report)).accounts);
    assert.equal("save" in dataSource, false);
  });
});

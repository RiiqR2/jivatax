import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountMatchingShadowComparisonService } from "./account-matching-shadow-comparison.service";

const generatedAt = new Date("2026-01-01T00:00:00.000Z");
const diagnostic = (companyAccountId: string, decision: string) => ({
  companyAccountId,
  decision,
  decisionReason: decision,
  generatedAt,
  // allCandidates deliberately starts with a discarded candidate.
  candidates: [{ code: "DISCARDED", name: "Discarded" }],
});

describe("AccountMatchingShadowComparisonService V7 semantics", () => {
  it("uses persisted final suggestions, preserves statuses and never compares unverified contexts", async () => {
    const ids = [
      "accepted",
      "review",
      "ambiguous",
      "none",
      "missing",
      "confirmed",
    ];
    const contexts = ids.map((id) => ({
      companyId: "company",
      companyAccountId: id,
      accountObservation: { accountCode: id, accountName: id },
      confirmedMapping:
        id === "confirmed"
          ? {
              companyAccountId: id,
              siiAccountId: "mapped-id",
              siiCode: "MAPPED",
              siiName: "Mapped",
              source: "manual",
            }
          : undefined,
      historicalCompanyMappings: [],
      companyAliases: [],
      catalogTerms: [],
      catalogAccounts: [],
    }));
    const diagnostics = [
      diagnostic("accepted", "automatic"),
      diagnostic("review", "review"),
      diagnostic("ambiguous", "ambiguous"),
      diagnostic("none", "no_candidate"),
    ];
    const suggestions = [
      {
        companyAccountId: "accepted",
        generatedAt,
        suggestionRank: 1,
        score: "90",
        confidence: "0.9",
        siiAccount: { code: "FINAL", name: "Final" },
      },
      {
        companyAccountId: "review",
        generatedAt,
        suggestionRank: 1,
        score: "50",
        confidence: "0.5",
        siiAccount: { code: "REVIEW", name: "Review" },
      },
      // These must be ignored because the diagnostic outcome has no winner.
      {
        companyAccountId: "ambiguous",
        generatedAt,
        suggestionRank: 1,
        score: "80",
        confidence: "0.8",
        siiAccount: { code: "AMB", name: "Amb" },
      },
      {
        companyAccountId: "none",
        generatedAt,
        suggestionRank: 1,
        score: "80",
        confidence: "0.8",
        siiAccount: { code: "NO", name: "No" },
      },
    ];
    let reads = 0;
    const dataSource = {
      manager: {
        getRepository: (target: { name: string }) => ({
          find: async () => {
            reads++;
            return target.name === "AccountMatchingDiagnosticEntity"
              ? diagnostics
              : suggestions;
          },
        }),
      },
    };
    const factory = { createBatch: async () => contexts };
    const pipeline = {
      resolve: () => ({
        decision: "strong",
        resolutionStatus: "resolved",
        warnings: [],
        autoConfirmed: false,
        candidates: [
          {
            siiAccountId: "v2-id",
            siiCode: "FINAL",
            siiName: "Final",
            resolutionType: "ranked",
            recommendationLevel: "strong",
            evidence: [],
            warnings: [],
          },
        ],
      }),
    };
    const classifier = {
      classify: (input: object) => ({
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
    const byId = new Map(
      report.accounts.map((item) => [item.companyAccountId, item]),
    );
    assert.equal(byId.get("accepted")?.v7.winnerCode, "FINAL");
    assert.notEqual(byId.get("accepted")?.v7.winnerCode, "DISCARDED");
    assert.deepEqual(byId.get("ambiguous")?.v7, {
      status: "ambiguous",
      contextMatch: "unverified",
      decision: "ambiguous",
    });
    assert.deepEqual(byId.get("none")?.v7, {
      status: "no_candidate",
      contextMatch: "unverified",
      decision: "no_candidate",
    });
    assert.equal(byId.get("review")?.v7.status, "review");
    assert.equal(byId.get("review")?.v7.winnerCode, "REVIEW");
    assert.equal(byId.get("confirmed")?.v7.status, "confirmed_mapping");
    assert.equal(byId.get("confirmed")?.v7.winnerCode, "MAPPED");
    assert.equal(byId.get("missing")?.v7.status, "unavailable");
    assert.equal(byId.get("accepted")?.v7.contextMatch, "unverified");
    assert.equal(report.summary.sameWinner, 0);
    assert.equal(report.summary.differentWinner, 0);
    assert.equal(report.summary.comparableAccounts, 0);
    assert.deepEqual(
      {
        unverified: report.summary.v7ContextUnverified,
        unavailable: report.summary.v7Unavailable,
        review: report.summary.v7Review,
        ambiguous: report.summary.v7Ambiguous,
        noCandidate: report.summary.v7NoCandidate,
      },
      {
        unverified: 5,
        unavailable: 1,
        review: 1,
        ambiguous: 1,
        noCandidate: 1,
      },
    );
    assert.equal(reads, 2);
    assert.equal("save" in dataSource, false);
  });
});

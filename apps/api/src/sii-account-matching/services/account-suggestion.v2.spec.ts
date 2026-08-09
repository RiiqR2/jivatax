import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DataSource } from "typeorm";
import { CompanyAccountSuggestionStatus } from "../../accounting/entities/company-account-suggestion.entity";
import {
  BalanceRole,
  TaxDocumentStatus,
  TaxDocumentType,
} from "../../accounting/enums/accounting.enums";
import { AccountMatchingDiagnosticEntity } from "../entities/account-matching-diagnostic.entity";
import type {
  MatchingResolutionContext,
  MatchingResolutionResult,
} from "../pipeline/account-matching-pipeline.types";
import { AccountSuggestionService } from "./account-suggestion.service";

const companyId = "company-1";
const taxPeriodId = "period-1";

const observation = (name: string) => ({
  observedSection: "asset" as const,
  balanceNature: "debit" as const,
  accountFamily: "unclassified" as const,
  relationshipClass: "unknown" as const,
  contraAccountType: "none" as const,
  specialTaxCategory: "none" as const,
  normalizedName: name.toLowerCase(),
  originalName: name,
  classificationEvidence: [],
  classificationWarnings: [],
});

const candidate = (
  siiAccountId: string,
  level: "strong" | "probable" | "weak",
  score: number,
) => ({
  siiAccountId,
  siiCode: `code-${siiAccountId}`,
  siiName: `name-${siiAccountId}`,
  resolutionType: "ranked" as const,
  recommendationLevel: level,
  evidence: ["compatible_token_overlap"],
  warnings: [],
  technicalScore: score,
  technicalConfidence: score,
  reviewRequired: true,
  referenceResolution: "direct" as const,
});

/** Minimal context; the pipeline is faked, so most evidence stays empty. */
const context = (
  companyAccountId: string,
  extra: Partial<MatchingResolutionContext> = {},
): MatchingResolutionContext =>
  ({
    companyId,
    companyAccountId,
    accountObservation: {
      accountCode: companyAccountId,
      accountName: companyAccountId,
    },
    historicalCompanyMappings: [],
    companyAliases: [],
    catalogTerms: [],
    catalogAccounts: [],
    ...extra,
  }) as MatchingResolutionContext;

const closingBalance = (id: string, versionNumber: number) => ({
  id,
  documentType: TaxDocumentType.BALANCE,
  balanceRole: BalanceRole.CLOSING,
  status: TaxDocumentStatus.PROCESSED,
  discardedAt: null,
  versionNumber,
});

function makeService(
  contexts: MatchingResolutionContext[],
  resolve: (context: MatchingResolutionContext) => MatchingResolutionResult,
  balanceDocuments: Array<Record<string, unknown>> = [
    closingBalance("balance-1", 5),
  ],
) {
  const savedSuggestions: Array<Record<string, unknown>> = [];
  const supersededAccounts: string[] = [];
  const diagnostics: Array<Record<string, unknown>> = [];
  const createBatchArgs: Array<{ balanceImportId: string }> = [];

  const suggestionRepository = {
    update: async (where: { companyAccountId: string }) => {
      supersededAccounts.push(where.companyAccountId);
      return undefined;
    },
    create: (value: Record<string, unknown>) => value,
    save: async (values: Array<Record<string, unknown>>) => {
      savedSuggestions.push(...values);
      return values;
    },
  };
  const diagnosticRepository = {
    softDelete: async () => undefined,
    create: (value: Record<string, unknown>) => value,
    save: async (value: Record<string, unknown>) => {
      diagnostics.push(value);
      return value;
    },
  };

  const dataSource = {
    getRepository: () => ({
      find: async () => balanceDocuments,
    }),
    transaction: async (
      callback: (manager: {
        getRepository: (entity: unknown) => unknown;
      }) => unknown,
    ) =>
      callback({
        getRepository: (entity: unknown) =>
          entity === AccountMatchingDiagnosticEntity
            ? diagnosticRepository
            : suggestionRepository,
      }),
  } as unknown as DataSource;

  const contextFactory = {
    createBatch: async (input: { balanceImportId: string }) => {
      createBatchArgs.push(input);
      return contexts;
    },
  } as never;
  const pipeline = { resolve } as never;
  const classifier = {
    classify: (input: { accountName: string }) =>
      observation(input.accountName),
  } as never;

  const service = new AccountSuggestionService(
    dataSource,
    undefined,
    undefined,
    undefined,
    contextFactory,
    pipeline,
    classifier,
  );
  return {
    service,
    savedSuggestions,
    supersededAccounts,
    diagnostics,
    createBatchArgs,
  };
}

const result = (
  decision: MatchingResolutionResult["decision"],
  candidates: MatchingResolutionResult["candidates"],
): MatchingResolutionResult => ({
  decision,
  candidates,
  resolutionStatus:
    decision === "no_candidate"
      ? "no_candidate"
      : decision === "ambiguous"
        ? "ambiguous"
        : "resolved",
  warnings: [],
  autoConfirmed: false,
});

describe("AccountSuggestionService v2 cutover", () => {
  it("maps v2 decisions to ACTIVE/REVIEW/no suggestion and preserves confirmed mappings", async () => {
    const contexts = [
      context("acc-strong"),
      context("acc-weak"),
      context("acc-ambiguous"),
      context("acc-none"),
      context("acc-confirmed", {
        confirmedMapping: {
          companyAccountId: "acc-confirmed",
          siiAccountId: "sii-confirmed",
          siiCode: "1.01.01.00",
          siiName: "Disponible",
          source: "manual",
        },
      }),
    ];
    const byAccount: Record<string, MatchingResolutionResult> = {
      "acc-strong": result("strong", [candidate("sii-a", "strong", 1)]),
      "acc-weak": result("weak", [candidate("sii-b", "weak", 0.4)]),
      "acc-ambiguous": result("ambiguous", [
        candidate("sii-c", "probable", 0.8),
        candidate("sii-d", "probable", 0.78),
      ]),
      "acc-none": result("no_candidate", []),
    };
    const {
      service,
      savedSuggestions,
      supersededAccounts,
      diagnostics,
      createBatchArgs,
    } = makeService(contexts, (ctx) => byAccount[ctx.companyAccountId]);

    const summary = await service.generateWithV2(companyId, taxPeriodId);

    // Evidence is loaded only for the selected closing Balance document, so
    // snapshots from other versions can never be mixed in.
    assert.deepEqual(
      createBatchArgs.map((arg) => arg.balanceImportId),
      ["balance-1"],
    );

    // Confirmed mapping is never regenerated nor superseded.
    assert.equal(summary.mappingsReused, 1);
    assert.ok(!supersededAccounts.includes("acc-confirmed"));
    assert.ok(
      !savedSuggestions.some((s) => s.companyAccountId === "acc-confirmed"),
    );

    // Every non-confirmed account retires its previous generation, even the
    // no_candidate one (so no stale suggestion survives).
    assert.deepEqual(supersededAccounts.sort(), [
      "acc-ambiguous",
      "acc-none",
      "acc-strong",
      "acc-weak",
    ]);

    const byId = (id: string) =>
      savedSuggestions.filter((s) => s.companyAccountId === id);
    assert.equal(
      byId("acc-strong")[0]?.status,
      CompanyAccountSuggestionStatus.ACTIVE,
    );
    assert.equal(byId("acc-strong")[0]?.suggestionRank, 1);
    assert.equal(
      byId("acc-weak")[0]?.status,
      CompanyAccountSuggestionStatus.REVIEW,
    );
    assert.equal(byId("acc-ambiguous").length, 2);
    assert.equal(
      byId("acc-ambiguous")[0]?.status,
      CompanyAccountSuggestionStatus.REVIEW,
    );
    assert.equal(byId("acc-ambiguous")[1]?.suggestionRank, 2);
    assert.equal(byId("acc-none").length, 0);

    assert.equal(summary.active, 1);
    assert.equal(summary.review, 2);
    assert.equal(summary.withoutSuggestion, 1);
    assert.equal(summary.suggestionsCreated, 4);
    assert.equal(summary.algorithmVersion, "deterministic-v2-pipeline");

    // A diagnostic is written for every processed non-confirmed account.
    assert.equal(diagnostics.length, 4);
    assert.equal(
      diagnostics.find((d) => d.companyAccountId === "acc-none")?.decision,
      "no_candidate",
    );
  });

  it("is a safe no-op without a valid closing balance: no supersede, no writes", async () => {
    const { service, savedSuggestions, supersededAccounts, createBatchArgs } =
      makeService(
        [context("acc-strong")],
        () => result("strong", [candidate("sii-a", "strong", 1)]),
        // Only invalid balances exist for the period (failed / discarded /
        // opening): none must be selected.
        [
          {
            id: "closing-failed",
            documentType: TaxDocumentType.BALANCE,
            balanceRole: BalanceRole.CLOSING,
            status: TaxDocumentStatus.PROCESSING_ERROR,
            discardedAt: null,
            versionNumber: 9,
          },
          {
            id: "opening-processed",
            documentType: TaxDocumentType.BALANCE,
            balanceRole: BalanceRole.OPENING,
            status: TaxDocumentStatus.PROCESSED,
            discardedAt: null,
            versionNumber: 8,
          },
          {
            id: "closing-discarded",
            documentType: TaxDocumentType.BALANCE,
            balanceRole: BalanceRole.CLOSING,
            status: TaxDocumentStatus.DISCARDED,
            discardedAt: new Date(),
            versionNumber: 7,
          },
        ],
      );

    const summary = (await service.generateWithV2(
      companyId,
      taxPeriodId,
    )) as Record<string, unknown>;

    assert.equal(summary.suggested, 0);
    assert.equal(summary.accountsProcessed, 0);
    assert.equal(summary.reason, "no_valid_closing_balance");
    assert.equal(summary.balanceImportId, null);
    // Nothing loaded, nothing superseded, nothing written.
    assert.equal(createBatchArgs.length, 0);
    assert.equal(supersededAccounts.length, 0);
    assert.equal(savedSuggestions.length, 0);
  });
});

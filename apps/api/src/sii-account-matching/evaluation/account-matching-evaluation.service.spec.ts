import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AccountObservationClassifierService } from "../pipeline/account-observation-classifier.service";
import type {
  MatchingResolutionContext,
  MatchingResolutionResult,
  SuggestionDecision,
} from "../pipeline/account-matching-pipeline.types";
import { AccountMatchingEvaluationService } from "./account-matching-evaluation.service";

const classifier = new AccountObservationClassifierService();
const input = {
  companyId: "company",
  taxPeriodId: "period",
  balanceImportId: "balance",
};

function context(
  id: string,
  name: string,
  extra: Partial<MatchingResolutionContext> = {},
): MatchingResolutionContext {
  return {
    companyId: "company",
    companyAccountId: id,
    accountObservation: { accountCode: id, accountName: name },
    historicalCompanyMappings: [],
    companyAliases: [],
    catalogTerms: [],
    catalogAccounts: [],
    ...extra,
  };
}
function result(
  decision: SuggestionDecision,
  options: { confirmed?: boolean; warning?: string; unresolved?: boolean } = {},
): MatchingResolutionResult {
  const candidate =
    decision === "no_candidate" ||
    (decision === "ambiguous" && options.unresolved)
      ? []
      : [
          {
            siiAccountId: "sii",
            siiCode: "1",
            siiName: "Destino",
            resolutionType: options.confirmed
              ? ("confirmed_mapping" as const)
              : ("ranked" as const),
            recommendationLevel:
              decision === "ambiguous" ? ("weak" as const) : decision,
            evidence: ["existing_evidence"],
            warnings: options.warning ? [options.warning] : [],
            technicalScore: 0,
            technicalConfidence: 0,
            reviewRequired: false,
            referenceResolution: "direct" as const,
          },
        ];
  return {
    decision,
    candidates: candidate,
    resolutionStatus: options.unresolved
      ? "confirmed_mapping_unresolved"
      : decision === "no_candidate"
        ? "no_candidate"
        : decision === "ambiguous"
          ? "ambiguous"
          : "resolved",
    warnings: options.unresolved
      ? ["confirmed_mapping_requires_manual_resolution"]
      : [],
    autoConfirmed: false,
  };
}
function service(results: Record<string, MatchingResolutionResult>) {
  const pipeline = {
    resolve: (ctx: MatchingResolutionContext) => results[ctx.companyAccountId],
  };
  return new AccountMatchingEvaluationService(
    {} as never,
    pipeline as never,
    classifier,
  );
}

describe("AccountMatchingEvaluationService", () => {
  it("categorizes recommendation levels, confirmed mappings and unresolved mappings", () => {
    const contexts = [
      context("s", "Caja"),
      context("p", "Banco"),
      context("w", "Clientes"),
      context("c", "Capital emitido"),
      context("u", "Proveedores"),
    ];
    const report = service({
      s: result("strong"),
      p: result("probable"),
      w: result("weak"),
      c: result("strong", { confirmed: true }),
      u: result("ambiguous", { unresolved: true }),
    }).analyze(input, contexts);
    assert.deepEqual(
      report.accounts.map((x) => x.evaluationCategory),
      [
        "strong_candidate",
        "probable_candidate",
        "weak_candidate",
        "confirmed_mapping",
        "blocked_confirmed_mapping",
      ],
    );
    assert.deepEqual(report.summary.percentages, {
      confirmedMappings: 20,
      strongCandidates: 20,
      probableCandidates: 20,
      weakCandidates: 20,
      ambiguous: 20,
      noCandidate: 0,
      contradictorySource: 0,
      protectedTaxCases: 0,
      needsManualReview: 40,
    });
  });

  it("detects protected tax and structural contradictions", () => {
    const tax = context("tax", "Gasto rechazado");
    const contradiction = context("bad", "Caja", {
      accountObservation: {
        accountCode: "bad",
        accountName: "Caja",
        assetAmount: "1",
        liabilityAmount: "1",
      },
    });
    const report = service({
      tax: result("strong"),
      bad: result("strong"),
    }).analyze(input, [tax, contradiction]);
    assert.equal(report.accounts[0].evaluationCategory, "protected_tax_case");
    assert.equal(report.accounts[1].evaluationCategory, "contradictory_source");
    assert.equal(report.alerts.structuralContradictions, 1);
  });

  it("alerts only recognizable basic families without candidates", () => {
    const report = service({
      basic: result("no_candidate"),
      specialized: result("no_candidate"),
    }).analyze(input, [
      context("basic", "Caja"),
      context("specialized", "Garantías entregadas a clientes"),
    ]);
    assert.equal(report.alerts.noCandidateBasicAccounts, 1);
    assert.equal(report.accounts[0].basicAccountWithoutCandidate, true);
    assert.equal(report.accounts[1].basicAccountWithoutCandidate, false);
  });

  it("does not prioritize a strong candidate with a soft warning", () => {
    const contexts = [
      context("soft", "Caja"),
      context("tax", "Gasto rechazado"),
      context("contradiction", "Banco", {
        accountObservation: {
          accountCode: "contradiction",
          accountName: "Banco",
          assetAmount: "1",
          liabilityAmount: "1",
        },
      }),
      context("none", "Banco"),
    ];
    const report = service({
      soft: result("strong", { warning: "temporal_class_undetermined" }),
      tax: result("strong"),
      contradiction: result("strong"),
      none: result("no_candidate"),
    }).analyze(input, contexts, "2026-01-01T00:00:00.000Z");
    assert.deepEqual(
      report.topIssues.map((x) => x.accountCode),
      ["tax", "contradiction", "none"],
    );
    assert.equal(report.accounts[0].reasonDetails[0].severity, "informational");
    assert.ok(report.topIssues.length <= 20);
    assert.equal(report.metadata.readOnly, true);
    assert.doesNotThrow(() => JSON.stringify(report));
  });

  it("counts only hard compatibility conflicts in alerts", () => {
    const contexts = [
      context("temporal-hard", "Caja"),
      context("temporal-soft", "Banco"),
      context("direction", "Clientes"),
      context("related-soft", "Préstamo relacionado"),
    ];
    const report = service({
      "temporal-hard": result("strong", {
        warning: "incompatible_temporal_class",
      }),
      "temporal-soft": result("strong", {
        warning: "temporal_class_undetermined",
      }),
      direction: result("strong", {
        warning: "receivable_payable_direction_mismatch",
      }),
      "related-soft": result("strong", {
        warning: "related_source_destination_relation_unspecified",
      }),
    }).analyze(input, contexts);
    assert.equal(report.alerts.currentNonCurrentConflicts, 1);
    assert.equal(report.alerts.receivablePayableConflicts, 1);
    assert.equal(report.alerts.relatedPartyConflicts, 0);
  });
});

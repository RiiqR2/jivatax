import { Injectable } from "@nestjs/common";
import type {
  MatchingResolutionContext,
  MatchingResolutionResult,
} from "../pipeline/account-matching-pipeline.types";
import { AccountObservationClassifierService } from "../pipeline/account-observation-classifier.service";
import { SiiAccountMatchingPipelineService } from "../pipeline/sii-account-matching-pipeline.service";
import {
  MatchingResolutionContextFactoryService,
  type MatchingResolutionBatchRequest,
} from "../services/matching-resolution-context-factory.service";
import type {
  EvaluationAccount,
  EvaluationCategory,
  EvaluationReasonSeverity,
  EvaluationReport,
} from "./account-matching-evaluation.types";

const BASIC_FAMILIES = new Set([
  "cash",
  "vat_credit",
  "vat_debit",
  "supplier_advance",
  "trade_receivable",
  "trade_payable",
  "issued_capital",
  "loan_receivable",
  "loan_payable",
]);

@Injectable()
export class AccountMatchingEvaluationService {
  constructor(
    private readonly contexts: MatchingResolutionContextFactoryService,
    private readonly pipeline: SiiAccountMatchingPipelineService,
    private readonly classifier: AccountObservationClassifierService,
  ) {}

  async evaluate(
    input: MatchingResolutionBatchRequest,
  ): Promise<EvaluationReport> {
    return this.analyze(input, await this.contexts.createBatch(input));
  }

  analyze(
    input: MatchingResolutionBatchRequest,
    contexts: MatchingResolutionContext[],
    generatedAt = new Date().toISOString(),
  ): EvaluationReport {
    const accounts = contexts.map((context) =>
      this.account(context, this.pipeline.resolve(context)),
    );
    const count = (category: EvaluationCategory) =>
      accounts.filter((x) => x.evaluationCategory === category).length;
    const total = accounts.length;
    const values = {
      confirmedMappings: count("confirmed_mapping"),
      strongCandidates: count("strong_candidate"),
      probableCandidates: count("probable_candidate"),
      weakCandidates: count("weak_candidate"),
      ambiguous: count("ambiguous") + count("blocked_confirmed_mapping"),
      noCandidate: count("no_candidate"),
      contradictorySource: count("contradictory_source"),
      protectedTaxCases: count("protected_tax_case"),
      needsManualReview: accounts.filter((x) =>
        [
          "weak_candidate",
          "ambiguous",
          "blocked_confirmed_mapping",
          "contradictory_source",
          "protected_tax_case",
          "structural_mismatch",
          "needs_manual_review",
        ].includes(x.evaluationCategory),
      ).length,
    };
    const alert = (test: (x: EvaluationAccount) => boolean) =>
      accounts.filter(test).length;
    const alerts = {
      structuralContradictions: alert((x) =>
        x.classificationWarnings.some((w) => w.startsWith("contradictory_")),
      ),
      protectedTaxCandidates: alert((x) => x.specialTaxCategory !== "none"),
      currentNonCurrentConflicts: alert((x) =>
        this.hasReason(x, "incompatible_temporal_class"),
      ),
      receivablePayableConflicts: alert((x) =>
        this.hasReason(x, "receivable_payable_direction_mismatch"),
      ),
      relatedPartyConflicts: alert((x) =>
        this.hasReason(x, "related_party_requires_explicit_evidence"),
      ),
      marketableSecuritiesConflicts: alert(
        (x) =>
          x.accountFamily === "marketable_securities" &&
          this.hasReason(x, "incompatible_financial_subfamily"),
      ),
      contraAccountConflicts: alert(
        (x) =>
          x.contraAccountType !== "none" &&
          x.reasonDetails.some(
            ({ reason, severity }) =>
              severity === "critical" && reason.startsWith("incompatible_"),
          ),
      ),
      noCandidateBasicAccounts: alert((x) => x.basicAccountWithoutCandidate),
    };
    const percentages = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        total ? Number(((value / total) * 100).toFixed(2)) : 0,
      ]),
    );
    return {
      metadata: { ...input, generatedAt, version: "v2", readOnly: true },
      summary: { totalAccounts: total, ...values, percentages },
      alerts,
      topIssues: this.topIssues(accounts),
      accounts,
    };
  }

  private account(
    context: MatchingResolutionContext,
    result: MatchingResolutionResult,
  ): EvaluationAccount {
    const input = context.accountObservation;
    const observation =
      "normalizedName" in input ? input : this.classifier.classify(input);
    const winner = result.candidates[0];
    const warnings = [
      ...observation.classificationWarnings,
      ...result.warnings,
      ...(winner?.warnings ?? []),
    ];
    const reasonDetails = [...new Set(warnings)].map((reason) => ({
      reason,
      severity: this.reasonSeverity(reason),
    }));
    const contradictory = observation.classificationWarnings.some((w) =>
      w.startsWith("contradictory_"),
    );
    const structural = warnings.some((w) =>
      /incompatible_statement_section|incompatible_balance_nature/.test(w),
    );
    let evaluationCategory: EvaluationCategory;
    if (result.resolutionStatus === "confirmed_mapping_unresolved")
      evaluationCategory = "blocked_confirmed_mapping";
    else if (winner?.resolutionType === "confirmed_mapping")
      evaluationCategory = "confirmed_mapping";
    else if (contradictory) evaluationCategory = "contradictory_source";
    else if (observation.specialTaxCategory !== "none")
      evaluationCategory = "protected_tax_case";
    else if (structural) evaluationCategory = "structural_mismatch";
    else if (result.decision === "strong")
      evaluationCategory = "strong_candidate";
    else if (result.decision === "probable")
      evaluationCategory = "probable_candidate";
    else if (result.decision === "weak") evaluationCategory = "weak_candidate";
    else evaluationCategory = result.decision;
    const basicAccount = BASIC_FAMILIES.has(observation.accountFamily);
    const candidate = (x: typeof winner) =>
      x && {
        siiCode: x.siiCode,
        siiName: x.siiName,
        recommendationLevel: x.recommendationLevel,
        evidence: x.evidence,
        warnings: x.warnings,
      };
    const raw = input as { accountCode?: string; accountName?: string };
    return {
      ...observation,
      companyAccountId: context.companyAccountId,
      accountCode: raw.accountCode ?? "",
      accountName: raw.accountName ?? observation.originalName,
      evaluationCategory,
      criticalCases: this.criticalCases(observation),
      reasons: warnings,
      reasonDetails,
      basicAccount,
      basicAccountWithoutCandidate:
        basicAccount && result.decision === "no_candidate",
      winner: winner
        ? { ...candidate(winner)!, resolutionType: winner.resolutionType }
        : undefined,
      alternatives: result.candidates.slice(1, 4).map((x) => candidate(x)!),
    };
  }

  private hasReason(account: EvaluationAccount, reason: string): boolean {
    return account.reasonDetails.some(
      (item) => item.reason === reason && item.severity === "critical",
    );
  }

  private reasonSeverity(reason: string): EvaluationReasonSeverity {
    if (
      reason.startsWith("contradictory_") ||
      reason.startsWith("incompatible_") ||
      reason.endsWith("_mismatch") ||
      reason.startsWith("protected_") ||
      reason === "confirmed_mapping_requires_manual_resolution" ||
      reason === "related_party_requires_explicit_evidence"
    )
      return "critical";
    if (reason.endsWith("_undetermined")) return "informational";
    return "warning";
  }
  private criticalCases(
    o:
      | EvaluationAccount
      | ReturnType<AccountObservationClassifierService["classify"]>,
  ): string[] {
    const values = new Set<string>();
    const family = o.accountFamily;
    const name = o.normalizedName;
    if (family === "cash") values.add("cash_bank");
    if (/receivable|vat_credit|supplier_advance|bad_debt/.test(family))
      values.add("receivables");
    if (
      /payable|vat_debit|bank_debt|lease_liability|customer_advance/.test(
        family,
      )
    )
      values.add("payables");
    if (o.temporalClass) values.add(`term_${o.temporalClass}`);
    if (o.relationshipClass === "related_party") values.add("related_party");
    if (family === "marketable_securities") values.add("marketable_securities");
    if (/anticipo|prepagad/.test(name)) values.add("prepaid");
    if (family === "bad_debt_allowance") values.add("bad_debt_allowance");
    if (o.contraAccountType !== "none") values.add("contra_account");
    if (/arrendamiento|derecho de uso/.test(name)) values.add("lease");
    if (/depreciacion acumulada|amortizacion acumulada/.test(name))
      values.add("accumulated_depreciation_amortization");
    if (o.observedSection === "equity") values.add("equity");
    if (o.observedSection === "income") values.add("revenue");
    if (o.observedSection === "expense") values.add("expense");
    if (o.specialTaxCategory !== "none") values.add("tax_protected");
    if (/puente|transitori|transito/.test(name))
      values.add("bridge_transitory");
    return [...values];
  }
  private topIssues(accounts: EvaluationAccount[]) {
    const priority = (x: EvaluationAccount) =>
      x.evaluationCategory === "blocked_confirmed_mapping"
        ? 1
        : x.evaluationCategory === "protected_tax_case"
          ? 2
          : ["contradictory_source", "structural_mismatch"].includes(
                x.evaluationCategory,
              )
            ? 3
            : x.evaluationCategory === "strong_candidate" &&
                x.reasonDetails.some(({ severity }) => severity === "critical")
              ? 4
              : x.basicAccountWithoutCandidate
                ? 5
                : x.basicAccount &&
                    ["weak_candidate", "ambiguous"].includes(
                      x.evaluationCategory,
                    )
                  ? 6
                  : [
                        "weak_candidate",
                        "ambiguous",
                        "needs_manual_review",
                      ].includes(x.evaluationCategory)
                    ? 7
                    : 99;
    return accounts
      .filter((x) => priority(x) < 99)
      .sort((a, b) => priority(a) - priority(b))
      .slice(0, 20)
      .map((x) => ({
        accountCode: x.accountCode,
        accountName: x.accountName,
        issueType: x.evaluationCategory,
        explanation:
          x.reasonDetails.find(({ severity }) => severity === "critical")
            ?.reason ??
          x.reasons[0] ??
          `Review ${x.evaluationCategory}`,
        winnerCode: x.winner?.siiCode,
        winnerName: x.winner?.siiName,
        evidence: x.winner?.evidence ?? x.classificationEvidence,
        warnings: x.reasons,
      }));
  }
}

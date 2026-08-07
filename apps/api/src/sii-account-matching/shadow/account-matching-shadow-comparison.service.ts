import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, In } from "typeorm";
import { ACCOUNT_SUGGESTION_CONFIG } from "../account-suggestion.config";
import { AccountMatchingDiagnosticEntity } from "../entities/account-matching-diagnostic.entity";
import { AccountObservationClassifierService } from "../pipeline/account-observation-classifier.service";
import type { AccountObservationInput } from "../pipeline/account-matching-pipeline.types";
import { SiiAccountMatchingPipelineService } from "../pipeline/sii-account-matching-pipeline.service";
import {
  MatchingResolutionContextFactoryService,
  type MatchingResolutionBatchRequest,
} from "../services/matching-resolution-context-factory.service";
import type {
  AccountMatchingShadowReport,
  ShadowAccountComparison,
  ShadowComparisonSummary,
  ShadowV7Result,
} from "./account-matching-shadow.types";

type StoredCandidate = {
  code?: string;
  name?: string;
  score?: number;
  confidence?: number;
};

/** Read-only comparison of persisted v7 diagnostics against the pure v2 pipeline. */
@Injectable()
export class AccountMatchingShadowComparisonService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly contexts: MatchingResolutionContextFactoryService,
    private readonly pipeline: SiiAccountMatchingPipelineService,
    private readonly classifier: AccountObservationClassifierService,
  ) {}

  async compare(
    input: MatchingResolutionBatchRequest,
  ): Promise<AccountMatchingShadowReport> {
    const contexts = await this.contexts.createBatch(input);
    const ids = contexts.map((context) => context.companyAccountId);
    const diagnostics = ids.length
      ? await this.dataSource.manager
          .getRepository(AccountMatchingDiagnosticEntity)
          .find({
            where: {
              companyId: input.companyId,
              taxPeriodId: input.taxPeriodId,
              companyAccountId: In(ids),
              algorithmVersion: ACCOUNT_SUGGESTION_CONFIG.algorithmVersion,
            },
            order: { generatedAt: "DESC" },
          })
      : [];
    const latest = new Map<string, AccountMatchingDiagnosticEntity>();
    for (const item of diagnostics)
      if (!latest.has(item.companyAccountId))
        latest.set(item.companyAccountId, item);

    const accounts = contexts.map((context): ShadowAccountComparison => {
      const observation = this.classifier.classify(
        context.accountObservation as AccountObservationInput,
      );
      const result = this.pipeline.resolve({
        ...context,
        accountObservation: observation,
      });
      const winner = result.candidates[0];
      const v7 = this.v7(latest.get(context.companyAccountId));
      const hasV7 = Boolean(v7.winnerCode);
      const hasV2 = Boolean(winner?.siiCode);
      return {
        companyAccountId: context.companyAccountId,
        accountCode: (context.accountObservation as AccountObservationInput)
          .accountCode,
        accountName: (context.accountObservation as AccountObservationInput)
          .accountName,
        observedSection: observation.observedSection,
        balanceNature: observation.balanceNature,
        accountFamily: observation.accountFamily,
        classificationWarnings: observation.classificationWarnings,
        v7,
        v2: {
          resolutionStatus: result.resolutionStatus,
          decision: result.decision,
          resolutionType: winner?.resolutionType,
          recommendationLevel: winner?.recommendationLevel,
          winnerCode: winner?.siiCode,
          winnerName: winner?.siiName,
          warnings: [
            ...observation.classificationWarnings,
            ...result.warnings,
            ...(winner?.warnings ?? []),
          ],
          evidence: winner?.evidence ?? [],
          candidateCount: result.candidates.length,
        },
        comparison: {
          sameWinner: hasV7 && hasV2 && v7.winnerCode === winner?.siiCode,
          v7Only: hasV7 && !hasV2,
          v2Only: !hasV7 && hasV2,
          bothNoCandidate: !hasV7 && !hasV2,
          differentWinner: hasV7 && hasV2 && v7.winnerCode !== winner?.siiCode,
          confirmedMappingReused: winner?.reusedConfirmedMapping === true,
        },
      };
    });
    return {
      metadata: {
        ...input,
        generatedAt: new Date().toISOString(),
        v2Version: "v2",
        v7Source: "persisted_account_matching_diagnostics",
        readOnly: true,
      },
      summary: this.summarize(accounts),
      accounts,
    };
  }

  private v7(item?: AccountMatchingDiagnosticEntity): ShadowV7Result {
    if (!item) return { available: false };
    const candidate = (item.candidates as StoredCandidate[])[0];
    return {
      available: true,
      winnerCode: candidate?.code,
      winnerName: candidate?.name,
      score: candidate?.score,
      confidence: candidate?.confidence,
      decision: item.decision,
      status: item.decisionReason,
    };
  }

  private summarize(
    accounts: ShadowAccountComparison[],
  ): ShadowComparisonSummary {
    const count = (test: (item: ShadowAccountComparison) => boolean) =>
      accounts.filter(test).length;
    return {
      totalAccounts: accounts.length,
      sameWinner: count((x) => x.comparison.sameWinner),
      differentWinner: count((x) => x.comparison.differentWinner),
      v7Only: count((x) => x.comparison.v7Only),
      v2Only: count((x) => x.comparison.v2Only),
      bothNoCandidate: count((x) => x.comparison.bothNoCandidate),
      confirmedMappingsReused: count(
        (x) => x.comparison.confirmedMappingReused,
      ),
      v2Strong: count((x) => x.v2.decision === "strong"),
      v2Probable: count((x) => x.v2.decision === "probable"),
      v2Weak: count((x) => x.v2.decision === "weak"),
      v2Ambiguous: count((x) => x.v2.decision === "ambiguous"),
      v2NoCandidate: count((x) => x.v2.decision === "no_candidate"),
    };
  }
}

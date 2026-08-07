import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, In } from "typeorm";
import { CompanyAccountSuggestionEntity } from "../../accounting/entities/company-account-suggestion.entity";
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

type PersistedWinner = CompanyAccountSuggestionEntity & {
  siiAccount: { code: string; name: string };
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
    const suggestions = ids.length
      ? ((await this.dataSource.manager
          .getRepository(CompanyAccountSuggestionEntity)
          .find({
            where: {
              companyAccountId: In(ids),
              algorithmVersion: ACCOUNT_SUGGESTION_CONFIG.algorithmVersion,
              suggestionRank: 1,
            },
            relations: { siiAccount: true },
          })) as PersistedWinner[])
      : [];
    const persistedWinners = new Map(
      suggestions.map((item) => [
        this.generationKey(item.companyAccountId, item.generatedAt),
        item,
      ]),
    );

    const accounts = contexts.map((context): ShadowAccountComparison => {
      const observation = this.classifier.classify(
        context.accountObservation as AccountObservationInput,
      );
      const result = this.pipeline.resolve({
        ...context,
        accountObservation: observation,
      });
      const winner = result.candidates[0];
      const diagnostic = latest.get(context.companyAccountId);
      const v7 = this.v7(
        diagnostic,
        diagnostic
          ? persistedWinners.get(
              this.generationKey(
                context.companyAccountId,
                diagnostic.generatedAt,
              ),
            )
          : undefined,
        context.confirmedMapping,
      );
      const hasV7 = Boolean(v7.winnerCode);
      const hasV2 = Boolean(winner?.siiCode);
      const comparable = v7.contextMatch === "verified";
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
          sameWinner:
            comparable && hasV7 && hasV2 && v7.winnerCode === winner?.siiCode,
          v7Only: comparable && hasV7 && !hasV2,
          v2Only: comparable && !hasV7 && hasV2,
          bothNoCandidate: comparable && !hasV7 && !hasV2,
          differentWinner:
            comparable && hasV7 && hasV2 && v7.winnerCode !== winner?.siiCode,
          confirmedMappingReused: winner?.reusedConfirmedMapping === true,
        },
      };
    });
    return {
      metadata: {
        ...input,
        generatedAt: new Date().toISOString(),
        v2Version: "v2",
        v7Source: "persisted_diagnostics_and_suggestions",
        readOnly: true,
      },
      summary: this.summarize(accounts),
      accounts,
    };
  }

  private v7(
    item?: AccountMatchingDiagnosticEntity,
    suggestion?: PersistedWinner,
    confirmedMapping?: { siiCode: string; siiName: string },
  ): ShadowV7Result {
    if (!item && confirmedMapping)
      return {
        status: "confirmed_mapping",
        contextMatch: "unverified",
        winnerCode: confirmedMapping.siiCode,
        winnerName: confirmedMapping.siiName,
      };
    if (!item) return { status: "unavailable", contextMatch: "unavailable" };
    if (item.decision === "ambiguous")
      return {
        status: "ambiguous",
        contextMatch: "unverified",
        decision: item.decision,
      };
    if (item.decision === "no_candidate")
      return {
        status: "no_candidate",
        contextMatch: "unverified",
        decision: item.decision,
      };
    return {
      status: item.decision === "review" ? "review" : "accepted",
      contextMatch: "unverified",
      winnerCode: suggestion?.siiAccount.code,
      winnerName: suggestion?.siiAccount.name,
      score: suggestion ? Number(suggestion.score) : undefined,
      confidence: suggestion ? Number(suggestion.confidence) : undefined,
      decision: item.decision,
    };
  }

  private generationKey(accountId: string, generatedAt: Date): string {
    return `${accountId}:${new Date(generatedAt).toISOString()}`;
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
      v7ContextVerified: count((x) => x.v7.contextMatch === "verified"),
      v7ContextUnverified: count((x) => x.v7.contextMatch === "unverified"),
      v7Unavailable: count((x) => x.v7.status === "unavailable"),
      v7Review: count((x) => x.v7.status === "review"),
      v7Ambiguous: count((x) => x.v7.status === "ambiguous"),
      v7NoCandidate: count((x) => x.v7.status === "no_candidate"),
      comparableAccounts: count((x) => x.v7.contextMatch === "verified"),
    };
  }
}

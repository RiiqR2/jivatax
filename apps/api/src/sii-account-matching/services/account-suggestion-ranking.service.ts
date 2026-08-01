import { Injectable } from "@nestjs/common";
import { ACCOUNT_SUGGESTION_CONFIG } from "../account-suggestion.config";
import type {
  BalanceContext,
  AccountNameContext,
  GeneratedCandidate,
  RankedCandidate,
  ObservedAccountSection,
} from "../account-matching.types";
import { singularize } from "../metadata/accounting-metadata";
import {
  normalizeAccountTerm,
  relevantWords,
  weightedTokenSimilarity,
} from "../normalization/account-term-normalizer";
import { AccountAttributeParserService } from "./account-attribute-parser.service";
import { normalizeAccountConcept } from "../normalization/account-concept-normalizer";
import { AccountRuleEngineService } from "../rules/account-rule-engine.service";
import { AccountConfidenceCalibratorService } from "../calibration/account-confidence-calibrator.service";
import type { AccountMatchingRuleEntity } from "../entities/account-matching-rule.entity";

const GENERIC_CONCEPTS = new Set(["activo", "pasivo", "impuesto", "gasto"]);

export type RankingDecision =
  "automatic" | "ambiguous" | "review" | "no_candidate";

type DiscardedCandidateAudit = {
  accountId: string;
  reasons: string[];
  condition: string;
  observedValue: unknown;
  requiredValue: unknown;
  discardedAt: string;
};

@Injectable()
export class AccountSuggestionRankingService {
  constructor(
    private readonly parser: AccountAttributeParserService = new AccountAttributeParserService(),
    private readonly rules: AccountRuleEngineService = new AccountRuleEngineService(),
    private readonly calibrator: AccountConfidenceCalibratorService = new AccountConfidenceCalibratorService(),
  ) {}

  rank(
    names: AccountNameContext | string,
    candidates: GeneratedCandidate[],
    context?: BalanceContext,
    configuredRules: AccountMatchingRuleEntity[] = [],
  ) {
    const { observedAccountName, canonicalAccountName } =
      typeof names === "string"
        ? { observedAccountName: names, canonicalAccountName: undefined }
        : names;
    const source = this.parser.parse(observedAccountName);
    const normalized = normalizeAccountTerm(observedAccountName);
    const normalizedCanonical = canonicalAccountName
      ? normalizeAccountTerm(canonicalAccountName)
      : undefined;
    const observed = this.observedSection(
      source.contraAccount,
      source.statementSection,
      context,
    );
    const ruleEvaluations = new Map(
      candidates.map((candidate) => [
        candidate.account.id,
        this.rules.evaluate(
          observedAccountName,
          source,
          observed,
          candidate,
          configuredRules,
        ),
      ]),
    );
    const discardedCandidates = candidates.flatMap<DiscardedCandidateAudit>(
      (candidate) => {
        if (ruleEvaluations.get(candidate.account.id)?.excluded)
          return [
            {
              accountId: candidate.account.id,
              reasons: ["excluded_by_rule"],
              condition: "ruleEvaluation.excluded === true",
              observedValue: true,
              requiredValue: false,
              discardedAt:
                "account-suggestion-ranking.service.ts:rank:excluded_by_rule",
            },
          ];
        if (!this.isHomologable(candidate))
          return [
            {
              accountId: candidate.account.id,
              reasons: ["aggregate_account_excluded"],
              condition: "candidate account name is not total/subtotal/suma",
              observedValue: candidate.account.name,
              requiredValue: "non-aggregate account name",
              discardedAt:
                "account-suggestion-ranking.service.ts:rank:aggregate_account_excluded",
            },
          ];
        if (!this.hasRequiredPrepaidSignal(normalized, candidate))
          return [
            {
              accountId: candidate.account.id,
              reasons:
                observed === "expense"
                  ? [
                      "current_expense_vs_prepaid_asset",
                      "missing_prepaid_signal",
                    ]
                  : ["missing_prepaid_signal"],
              condition:
                "prepaid-expense destination requires an explicit prepaid token",
              observedValue: normalized,
              requiredValue: "anticipad|prepag|prepago|pagado por adelantado",
              discardedAt:
                "account-suggestion-ranking.service.ts:rank:missing_prepaid_signal",
            },
          ];
        if (
          candidate.metadata.statementSection === "unknown" &&
          observed !== "unknown"
        )
          return [
            {
              accountId: candidate.account.id,
              reasons: ["unknown_candidate_classification"],
              condition:
                "classified source cannot use an unknown destination section",
              observedValue: candidate.metadata.statementSection,
              requiredValue: observed,
              discardedAt:
                "account-suggestion-ranking.service.ts:rank:unknown_candidate_classification",
            },
          ];
        if (
          !this.isCompatible(
            observed,
            candidate.metadata.statementSection,
            candidate.metadata.contraAccount,
          )
        )
          return [
            {
              accountId: candidate.account.id,
              reasons: [
                this.incompatibilityReason(
                  observed,
                  candidate.metadata.statementSection,
                  candidate.metadata.contraAccount,
                ),
              ],
              condition:
                "observed and destination statement sections compatible",
              observedValue: {
                source: observed,
                destination: candidate.metadata.statementSection,
                destinationContraAccount: candidate.metadata.contraAccount,
              },
              requiredValue: observed,
              discardedAt:
                "account-suggestion-ranking.service.ts:rank:isCompatible",
            },
          ];
        return [];
      },
    );
    const ranked = candidates
      .filter(
        (candidate) => !ruleEvaluations.get(candidate.account.id)?.excluded,
      )
      .filter((candidate) => this.isHomologable(candidate))
      .filter((candidate) =>
        this.hasRequiredPrepaidSignal(normalized, candidate),
      )
      .filter((candidate) =>
        this.isCompatible(
          observed,
          candidate.metadata.statementSection,
          candidate.metadata.contraAccount,
        ),
      )
      .map((candidate): RankedCandidate => {
        const variants = [
          candidate.account.name,
          ...candidate.terms.map((term) => term.term),
        ];
        const best = variants
          .map((term) => this.lexicalSignals(normalized, term))
          .sort((a, b) => b.points - a.points)[0];
        const reasons = [...(best?.reasons ?? [])];
        const aliasSimilarity = candidate.terms
          .filter((term) => term.type !== "official_name")
          .reduce(
            (maximum, term) =>
              Math.max(
                maximum,
                weightedTokenSimilarity(normalized, term.normalizedTerm),
              ),
            0,
          );
        if (
          aliasSimilarity >=
          ACCOUNT_SUGGESTION_CONFIG.semanticEvidence.minimumAliasTokenSimilarity
        )
          reasons.push(
            this.reason(
              "semantic_alias_hit",
              `Alias contable relevante (${Math.round(aliasSimilarity * 100)}%)`,
              0,
            ),
          );
        if (normalizedCanonical && normalizedCanonical !== normalized) {
          const canonicalBest = variants
            .map((term) => this.lexicalSignals(normalizedCanonical, term))
            .sort((a, b) => b.points - a.points)[0];
          const canonicalTotal = canonicalBest?.points ?? 0;
          const canonicalScale = canonicalTotal
            ? Math.min(
                1,
                ACCOUNT_SUGGESTION_CONFIG.weights.prefixMaximum /
                  canonicalTotal,
              )
            : 0;
          reasons.push(
            ...(canonicalBest?.reasons ?? []).map((reason) => ({
              ...reason,
              signal: `canonical_${reason.signal}`,
              description: `Nombre canónico histórico: ${reason.description}`,
              points: reason.points * canonicalScale,
            })),
          );
        }
        reasons.push(
          ...(ruleEvaluations.get(candidate.account.id)?.signals ?? []),
        );
        const learned =
          candidate.learning?.filter(
            (item) => item.normalizedName === normalized,
          ) ?? [];
        for (const item of learned) {
          // Confidence already includes agreement rate. Multiplying it by the
          // lexical similarity avoids counting agreement twice.
          const similarity = weightedTokenSimilarity(
            normalized,
            item.normalizedName,
          );
          const points =
            similarity *
            Number(item.confidence) *
            ACCOUNT_SUGGESTION_CONFIG.weights.globalLearningMaximum;
          reasons.push({
            signal: "supervised_learning_global",
            description: `${item.confirmationCount} confirmación(es) supervisada(s) globales`,
            points,
            kind: "evidence",
            source: "history",
          });
          if (item.industryEvidence) {
            reasons.push({
              signal: "supervised_learning_industry",
              description: `${item.industryEvidence.confirmationCount} confirmación(es) supervisada(s) del rubro`,
              points:
                similarity *
                Number(item.industryEvidence.confidence) *
                ACCOUNT_SUGGESTION_CONFIG.weights.globalLearningMaximum *
                ACCOUNT_SUGGESTION_CONFIG.weights.industryLearningWeight,
              kind: "evidence",
              source: "history",
            });
          }
        }
        reasons.push(...this.conceptReasons(normalized, source, candidate));
        if (
          source.family === candidate.metadata.family &&
          source.family !== "other"
        )
          reasons.push(
            this.reason(
              "family_match",
              "Familia contable compatible",
              ACCOUNT_SUGGESTION_CONFIG.weights.familyMatch,
            ),
          );
        if (
          observed === "expense" &&
          source.family === "expenses" &&
          candidate.metadata.family === "expenses" &&
          (/^costo/.test(normalized)
            ? /costo de venta|costo operacional/.test(
                normalizeAccountTerm(candidate.account.name),
              )
            : /administracion|gasto operacional|servicios/.test(
                normalizeAccountTerm(candidate.account.name),
              ))
        )
          reasons.push(
            this.reason(
              /^costo/.test(normalized)
                ? "cost_classification_match"
                : "observed_expense_classification",
              /^costo/.test(normalized)
                ? "Costo del período compatible con costo operacional"
                : "Gasto del período compatible con gasto operacional",
              ACCOUNT_SUGGESTION_CONFIG.weights.familyMatch,
            ),
          );
        const sharedConcepts = source.concepts.filter((concept) =>
          candidate.metadata.concepts.includes(concept),
        );
        if (sharedConcepts.length)
          reasons.push(
            this.reason(
              "concept_match",
              `Conceptos comunes: ${sharedConcepts.join(", ")}`,
              Math.min(
                ACCOUNT_SUGGESTION_CONFIG.weights.conceptMatchMaximum,
                sharedConcepts.length * 8,
              ),
            ),
          );
        if (source.term && source.term === candidate.metadata.term)
          reasons.push(
            this.reason(
              "term_match",
              "Plazo contable compatible",
              ACCOUNT_SUGGESTION_CONFIG.weights.termMatch,
            ),
          );
        if (
          source.contraAccount === candidate.metadata.contraAccount &&
          source.contraAccount
        )
          reasons.push(
            this.reason(
              "contra_account_match",
              "Cuenta complementaria compatible",
              ACCOUNT_SUGGESTION_CONFIG.weights.contraAccountMatch,
            ),
          );
        reasons.push(...this.contextReasons(candidate, context));
        if (observed !== "unknown")
          reasons.push(
            this.reason(
              "compatible_statement_section",
              "Sección contable compatible",
              0,
            ),
          );
        if (!reasons.length)
          reasons.push(
            this.reason(
              "no_matching_signal",
              "Candidato evaluado sin coincidencias positivas",
              0,
            ),
          );
        const score = reasons.reduce(
          (total, reason) => total + reason.points,
          0,
        );
        const semanticEvidenceReasons = this.semanticEvidenceReasons(
          reasons,
          normalized,
          candidate,
        );
        return {
          ...candidate,
          score,
          confidence: 0,
          reasons,
          semanticEvidenceSatisfied: semanticEvidenceReasons.length > 0,
          semanticEvidenceReasons,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score || a.account.code.localeCompare(b.account.code),
      );
    ranked.forEach((candidate, index) => {
      candidate.confidence = this.calibrator.calibrate(
        candidate,
        ranked[index + 1]?.score ?? 0,
        ranked.length,
      );
    });
    const top = ranked.slice(0, ACCOUNT_SUGGESTION_CONFIG.topCandidates);
    const gap = (top[0]?.score ?? 0) - (top[1]?.score ?? 0);
    const decision: RankingDecision = !top.length
      ? "no_candidate"
      : ruleEvaluations.get(top[0].account.id)?.review
        ? "review"
        : top[0].metadata.statementSection === "unknown"
          ? "review"
          : top[0].score < ACCOUNT_SUGGESTION_CONFIG.minimumSuggestionScore
            ? "review"
            : top[0].confidence <
                ACCOUNT_SUGGESTION_CONFIG.minimumAutomaticConfidence
              ? "review"
              : top.length > 1 &&
                  (gap < ACCOUNT_SUGGESTION_CONFIG.minimumAbsoluteDifference ||
                    gap / Math.max(top[0].score, 1) <
                      ACCOUNT_SUGGESTION_CONFIG.minimumRelativeDifference)
                ? "ambiguous"
                : "automatic";
    const decisionAudit = this.decisionAudit(
      decision,
      top,
      gap,
      top[0]
        ? (ruleEvaluations.get(top[0].account.id)?.review ?? false)
        : false,
    );
    if (decision === "ambiguous")
      for (const item of top)
        item.reasons.push(
          this.reason(
            "ambiguous_candidates",
            "Los primeros candidatos tienen puntajes próximos",
            0,
          ),
        );
    return {
      candidates: top,
      allCandidates: ranked,
      decision,
      reviewRequiredByRule: Boolean(
        top[0] && ruleEvaluations.get(top[0].account.id)?.review,
      ),
      discardedCandidates,
      observedSection: observed,
      evaluatedRules: [
        ...new Set(
          [...ruleEvaluations.values()].flatMap(
            (item) => item.evaluatedRuleIds,
          ),
        ),
      ],
      decisionAudit,
    };
  }

  private semanticEvidenceReasons(
    reasons: RankedCandidate["reasons"],
    normalizedSource: string,
    candidate: GeneratedCandidate,
  ): string[] {
    const config = ACCOUNT_SUGGESTION_CONFIG.semanticEvidence;
    const genericTokens = new Set([
      "cuenta",
      "costo",
      "gasto",
      "pagar",
      "servicio",
    ]);
    const sourceTokens = new Set(
      [...relevantWords(normalizedSource)]
        .map(singularize)
        .filter((token) => !genericTokens.has(token)),
    );
    const meaningfulSharedToken = [
      candidate.account.name,
      ...candidate.terms.map((term) => term.term),
    ].some((variant) =>
      [...relevantWords(variant)]
        .map(singularize)
        .some((token) => sourceTokens.has(token)),
    );
    return reasons.flatMap((reason) => {
      if (reason.signal === "semantic_alias_hit") return [reason.signal];
      if (reason.points <= 0 || reason.signal.startsWith("canonical_"))
        return [];
      if (
        reason.signal === "exact_alias" ||
        reason.signal === "exact_concept" ||
        reason.signal === "supervised_learning_global" ||
        reason.signal === "supervised_learning_industry"
      )
        return [reason.signal];
      if (reason.signal.startsWith("rule:")) return [reason.signal];
      if (
        reason.signal === "jaccard" &&
        meaningfulSharedToken &&
        reason.points / ACCOUNT_SUGGESTION_CONFIG.weights.jaccardMaximum >=
          config.minimumJaccardSimilarity
      )
        return [reason.signal];
      if (
        reason.signal === "character_trigrams" &&
        reason.points / ACCOUNT_SUGGESTION_CONFIG.weights.trigramMaximum >=
          config.minimumTrigramSimilarity
      )
        return [reason.signal];
      return [];
    });
  }

  private decisionAudit(
    decision: RankingDecision,
    top: RankedCandidate[],
    gap: number,
    reviewByRule: boolean,
  ) {
    const winner = top[0];
    const observed = {
      candidateCount: top.length,
      reviewByRule,
      statementSection: winner?.metadata.statementSection,
      score: winner?.score,
      confidence: winner?.confidence,
      absoluteGap: gap,
      relativeGap: gap / Math.max(winner?.score ?? 0, 1),
    };
    const thresholds = {
      minimumScore: ACCOUNT_SUGGESTION_CONFIG.minimumSuggestionScore,
      minimumConfidence: ACCOUNT_SUGGESTION_CONFIG.minimumAutomaticConfidence,
      minimumAbsoluteGap: ACCOUNT_SUGGESTION_CONFIG.minimumAbsoluteDifference,
      minimumRelativeGap: ACCOUNT_SUGGESTION_CONFIG.minimumRelativeDifference,
    };
    return {
      decision,
      observed,
      thresholds,
      discardedAt:
        decision === "automatic"
          ? null
          : "account-suggestion-ranking.service.ts:rank:final-decision",
    };
  }

  private observedSection(
    contraAccount: boolean,
    nameSection: string,
    context?: BalanceContext,
  ): ObservedAccountSection {
    if (!context) return "unknown";
    if (Number(context.assetAmount))
      return contraAccount ? "contra_asset" : "asset";
    if (Number(context.lossAmount)) return "expense";
    if (Number(context.gainAmount)) return "income";
    if (Number(context.liabilityAmount)) {
      // Balance columns do not distinguish ordinary liabilities from equity;
      // concepts in the internal name provide that pending context.
      if (nameSection === "equity") return "equity";
      return contraAccount ? "contra_liability" : "liability";
    }
    return "unknown";
  }

  private isHomologable(candidate: GeneratedCandidate): boolean {
    return !/(^|\s)(total|subtotal|suma)(es)?(\s|$)/i.test(
      candidate.account.name,
    );
  }

  private hasRequiredPrepaidSignal(
    normalizedSource: string,
    candidate: GeneratedCandidate,
  ): boolean {
    if (candidate.metadata.family !== "prepaid_expenses") return true;
    return /anticipad|prepag|prepago|pagado por adelantado/.test(
      normalizedSource,
    );
  }

  private isCompatible(
    observed: ObservedAccountSection,
    target: string,
    targetContra: boolean,
  ): boolean {
    if (observed === "unknown") return true;
    // Unknown catalogue classification is review-only. It cannot occupy an
    // active Top N for an account whose Balance section is explicit.
    if (target === "unknown") return false;
    if (observed === "contra_asset") return target === "asset" && targetContra;
    if (observed === "contra_liability")
      return target === "liability" && targetContra;
    if (targetContra) return false;
    return observed === target;
  }

  private incompatibilityReason(
    observed: ObservedAccountSection,
    target: string,
    targetContra: boolean,
  ): "incompatible_contra_account" | "incompatible_statement_section" {
    const observedContra =
      observed === "contra_asset" || observed === "contra_liability";
    const observedBase = observedContra
      ? observed === "contra_asset"
        ? "asset"
        : "liability"
      : observed;
    return observedBase === target && observedContra !== targetContra
      ? "incompatible_contra_account"
      : "incompatible_statement_section";
  }

  private lexicalSignals(left: string, rawRight: string) {
    const right = normalizeAccountTerm(rawRight);
    const leftTokens = new Set([...relevantWords(left)].map(singularize));
    const rightTokens = new Set([...relevantWords(right)].map(singularize));
    const union = new Set([...leftTokens, ...rightTokens]);
    const intersection = [...leftTokens].filter((token) =>
      rightTokens.has(token),
    );
    const jaccard = union.size ? intersection.length / union.size : 0;
    const trigram = this.jaccard(this.trigrams(left), this.trigrams(right));
    const reasons: RankedCandidate["reasons"] = [];
    if (left === right)
      reasons.push(
        this.reason(
          "exact_alias",
          `Coincidencia exacta: ${rawRight}`,
          ACCOUNT_SUGGESTION_CONFIG.weights.exactAlias,
        ),
      );
    if (jaccard)
      reasons.push(
        this.reason(
          "jaccard",
          `Jaccard de tokens ${Math.round(jaccard * 100)}%`,
          Math.round(
            jaccard * ACCOUNT_SUGGESTION_CONFIG.weights.jaccardMaximum,
          ),
        ),
      );
    if (trigram)
      reasons.push(
        this.reason(
          "character_trigrams",
          `Trigramas ${Math.round(trigram * 100)}%`,
          Math.round(
            trigram * ACCOUNT_SUGGESTION_CONFIG.weights.trigramMaximum,
          ),
        ),
      );
    if (
      leftTokens.size &&
      [...leftTokens].some((token) =>
        [...rightTokens].some(
          (other) =>
            token !== other &&
            (token.startsWith(other) || other.startsWith(token)),
        ),
      )
    )
      reasons.push(
        this.reason(
          "prefix_match",
          "Prefijo o abreviatura compatible",
          ACCOUNT_SUGGESTION_CONFIG.weights.prefixMaximum,
        ),
      );
    return {
      reasons,
      points: reasons.reduce((sum, reason) => sum + reason.points, 0),
    };
  }

  private conceptReasons(
    normalizedName: string,
    source: ReturnType<AccountAttributeParserService["parse"]>,
    candidate: GeneratedCandidate,
  ): RankedCandidate["reasons"] {
    const reasons: RankedCandidate["reasons"] = [];
    const weights = ACCOUNT_SUGGESTION_CONFIG.weights;
    for (const concept of candidate.concepts) {
      const value = normalizeAccountConcept(
        concept.normalizedConcept || concept.concept,
      );
      const exact =
        value &&
        !GENERIC_CONCEPTS.has(value) &&
        (normalizedName === value || normalizedName.includes(value));
      if (exact)
        reasons.push(
          this.reason(
            "exact_concept",
            `Coincidencia conceptual: “${concept.concept}”`,
            weights.exactConceptMatch,
          ),
        );
      const compatible =
        concept.conceptType === "accounting_family"
          ? this.familyCompatible(source.family, value)
          : concept.conceptType === "statement_section"
            ? value.includes(this.sectionSpanish(source.statementSection))
            : concept.conceptType === "balance_nature"
              ? value.includes(
                  source.expectedBalanceNature === "debit"
                    ? "deudor"
                    : "acreedor",
                )
              : concept.conceptType === "temporal_classification"
                ? Boolean(
                    source.term &&
                    value.includes(
                      source.term === "current" ? "corto plazo" : "largo plazo",
                    ),
                  )
                : concept.conceptType === "contra_account_indicator"
                  ? source.contraAccount
                  : false;
      if (!compatible) continue;
      const signal = (
        {
          accounting_family: "accounting_family_match",
          statement_section: "statement_section_match",
          balance_nature: "balance_nature_match",
          temporal_classification: "temporal_classification_match",
          contra_account_indicator: "contra_account_match",
        } as const
      )[
        concept.conceptType as
          | "accounting_family"
          | "statement_section"
          | "balance_nature"
          | "temporal_classification"
          | "contra_account_indicator"
      ];
      const points = (
        {
          accounting_family: weights.accountingFamilyMatch,
          statement_section: weights.statementSectionMatch,
          balance_nature: weights.balanceNatureMatch,
          temporal_classification: weights.temporalClassificationMatch,
          contra_account_indicator: weights.conceptContraAccountMatch,
        } as const
      )[
        concept.conceptType as
          | "accounting_family"
          | "statement_section"
          | "balance_nature"
          | "temporal_classification"
          | "contra_account_indicator"
      ];
      if (
        signal &&
        points &&
        !reasons.some((reason) => reason.signal === signal)
      )
        reasons.push(
          this.reason(
            signal,
            `Concepto compatible: ${concept.concept}`,
            points,
          ),
        );
    }
    return reasons;
  }

  private familyCompatible(family: string, concept: string): boolean {
    return (
      (
        {
          cash: /liquidez|circulante/,
          receivables: /cobrar|credito comercial/,
          fixed_assets: /activo fijo|propiedad planta/,
          depreciation: /activo fijo/,
          financial_liabilities: /financiera|pasivo/,
          payables: /obligacion comercial|pasivo/,
          equity: /patrimonio/,
          income: /ingreso/,
          expenses: /gasto|costo/,
        } as Record<string, RegExp>
      )[family]?.test(concept) ?? false
    );
  }

  private sectionSpanish(section: string): string {
    return (
      (
        {
          asset: "activo",
          liability: "pasivo",
          equity: "patrimonio",
          income: "ingreso",
          expense: "resultado",
        } as Record<string, string>
      )[section] ?? section
    );
  }

  private contextReasons(
    candidate: GeneratedCandidate,
    context?: BalanceContext,
  ): RankedCandidate["reasons"] {
    if (!context) return [];
    const observed = Number(context.liabilityAmount)
      ? "liability"
      : Number(context.assetAmount)
        ? "asset"
        : Number(context.lossAmount)
          ? "expense"
          : Number(context.gainAmount)
            ? "income"
            : null;
    const reasons: RankedCandidate["reasons"] = [];
    if (observed) {
      const compatible =
        observed === candidate.metadata.statementSection ||
        (candidate.metadata.contraAccount && observed === "asset");
      reasons.push(
        this.reason(
          compatible ? "balance_match" : "balance_mismatch",
          compatible
            ? "Clasificación del Balance compatible"
            : "Clasificación del Balance incompatible",
          compatible
            ? ACCOUNT_SUGGESTION_CONFIG.weights.compatibleClassification
            : ACCOUNT_SUGGESTION_CONFIG.weights.incompatibleClassification,
        ),
      );
    }
    if (Number(context.debitBalance) || Number(context.creditBalance)) {
      const observedNature = Number(context.creditBalance) ? "credit" : "debit";
      const compatible =
        observedNature === candidate.metadata.expectedBalanceNature;
      reasons.push(
        this.reason(
          compatible ? `${observedNature}_balance` : "balance_nature_mismatch",
          compatible
            ? "Naturaleza del saldo compatible"
            : "Naturaleza del saldo incompatible",
          compatible
            ? ACCOUNT_SUGGESTION_CONFIG.weights.compatibleBalanceNature
            : ACCOUNT_SUGGESTION_CONFIG.weights.incompatibleBalanceNature,
        ),
      );
    }
    return reasons;
  }

  private trigrams(value: string) {
    const padded = `  ${value}  `;
    return new Set(
      Array.from({ length: Math.max(0, padded.length - 2) }, (_, i) =>
        padded.slice(i, i + 3),
      ),
    );
  }
  private jaccard(left: Set<string>, right: Set<string>) {
    const union = new Set([...left, ...right]);
    return union.size
      ? [...left].filter((item) => right.has(item)).length / union.size
      : 0;
  }
  private reason(signal: string, description: string, points: number) {
    return {
      signal,
      description,
      points,
      kind: points < 0 ? ("penalty" as const) : ("evidence" as const),
      source: signal.includes("balance")
        ? ("balance" as const)
        : signal.includes("concept") ||
            signal.includes("family") ||
            signal.includes("section")
          ? ("knowledge" as const)
          : ("lexical" as const),
    };
  }
}

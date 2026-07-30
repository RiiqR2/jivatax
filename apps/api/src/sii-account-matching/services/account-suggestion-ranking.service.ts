import { Injectable } from "@nestjs/common";
import { ACCOUNT_SUGGESTION_CONFIG } from "../account-suggestion.config";
import type {
  BalanceContext,
  GeneratedCandidate,
  RankedCandidate,
} from "../account-matching.types";
import { singularize } from "../metadata/accounting-metadata";
import {
  normalizeAccountTerm,
  relevantWords,
} from "../normalization/account-term-normalizer";
import { AccountAttributeParserService } from "./account-attribute-parser.service";

export type RankingDecision =
  "automatic" | "ambiguous" | "review" | "no_candidate";

@Injectable()
export class AccountSuggestionRankingService {
  constructor(
    private readonly parser: AccountAttributeParserService = new AccountAttributeParserService(),
  ) {}

  rank(
    name: string,
    candidates: GeneratedCandidate[],
    context?: BalanceContext,
  ) {
    const source = this.parser.parse(name);
    const normalized = normalizeAccountTerm(name);
    const ranked = candidates
      .map((candidate): RankedCandidate => {
        const variants = [
          candidate.account.name,
          ...candidate.terms.map((term) => term.term),
        ];
        const best = variants
          .map((term) => this.lexicalSignals(normalized, term))
          .sort((a, b) => b.points - a.points)[0];
        const reasons = [...(best?.reasons ?? [])];
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
        const score = reasons.reduce(
          (total, reason) => total + reason.points,
          0,
        );
        return {
          ...candidate,
          score,
          confidence: Math.max(
            0,
            Math.min(
              1,
              score / ACCOUNT_SUGGESTION_CONFIG.scoreForFullConfidence,
            ),
          ),
          reasons,
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score || a.account.code.localeCompare(b.account.code),
      );
    const top = ranked.slice(0, ACCOUNT_SUGGESTION_CONFIG.topCandidates);
    const gap = (top[0]?.score ?? 0) - (top[1]?.score ?? 0);
    const decision: RankingDecision = !top.length
      ? "no_candidate"
      : top[0].score < ACCOUNT_SUGGESTION_CONFIG.minimumSuggestionScore
        ? "review"
        : top.length > 1 &&
            (gap < ACCOUNT_SUGGESTION_CONFIG.minimumAbsoluteDifference ||
              gap / Math.max(top[0].score, 1) <
                ACCOUNT_SUGGESTION_CONFIG.minimumRelativeDifference)
          ? "ambiguous"
          : "automatic";
    if (decision === "ambiguous")
      for (const item of top)
        item.reasons.push(
          this.reason(
            "ambiguous_candidates",
            "Los primeros candidatos tienen puntajes próximos",
            0,
          ),
        );
    return { candidates: top, decision };
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
    return { signal, description, points };
  }
}

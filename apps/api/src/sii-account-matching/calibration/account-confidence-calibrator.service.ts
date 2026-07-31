import { Injectable } from "@nestjs/common";
import type { RankedCandidate } from "../account-matching.types";

@Injectable()
export class AccountConfidenceCalibratorService {
  calibrate(
    candidate: RankedCandidate,
    secondScore: number,
    candidateCount: number,
  ): number {
    const evidence = candidate.reasons.filter((item) => item.points > 0);
    const penalties = candidate.reasons.filter((item) => item.points < 0);
    const strongRules = candidate.reasons.filter(
      (item) => item.kind === "rule" && item.points >= 40,
    ).length;
    const gap = Math.max(0, candidate.score - secondScore);
    const scoreComponent = Math.min(0.55, Math.max(0, candidate.score) / 180);
    const signalComponent = Math.min(0.18, evidence.length * 0.025);
    const gapComponent = Math.min(0.18, gap / 100);
    const historyComponent = candidate.reasons.some(
      (item) => item.source === "history",
    )
      ? 0.08
      : 0;
    const ruleComponent = Math.min(0.08, strongRules * 0.04);
    const penalty = Math.min(
      0.35,
      penalties.length * 0.08 +
        Math.abs(penalties.reduce((sum, item) => sum + item.points, 0)) / 400,
    );
    const competitionPenalty = Math.min(
      0.08,
      Math.max(0, candidateCount - 1) * 0.01,
    );
    // Exact evidence can be excellent, but 100% remains reserved for multiple independent confirmations.
    return Number(
      Math.max(
        0,
        Math.min(
          0.99,
          scoreComponent +
            signalComponent +
            gapComponent +
            historyComponent +
            ruleComponent -
            penalty -
            competitionPenalty,
        ),
      ).toFixed(4),
    );
  }
}

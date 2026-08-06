import { Injectable } from "@nestjs/common";
import type {
  SuggestionCandidate,
  SuggestionDecision,
} from "./account-matching-pipeline.types";

@Injectable()
export class SuggestionDecisionService {
  decide(candidates: SuggestionCandidate[]): SuggestionDecision {
    if (!candidates.length) return "no_candidate";
    const ordered = [...candidates].sort(
      (left, right) => right.technicalScore - left.technicalScore,
    );
    if (
      ordered[1] &&
      Math.abs(ordered[0].technicalScore - ordered[1].technicalScore) < 0.1
    )
      return "ambiguous";
    return ordered[0].recommendationLevel;
  }
}

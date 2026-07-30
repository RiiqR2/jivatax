export interface MatchingOutcome {
  expectedSiiAccountId?: string;
  candidateIds: string[];
  accepted?: boolean;
  corrected?: boolean;
  ambiguous?: boolean;
}

/** Pure accumulator so evaluation can run offline without changing production data. */
export function accountMatchingMetrics(outcomes: MatchingOutcome[]) {
  const labelled = outcomes.filter((item) => item.expectedSiiAccountId);
  const hit = (item: MatchingOutcome, depth: number) =>
    item.candidateIds.slice(0, depth).includes(item.expectedSiiAccountId!);
  const ratio = (count: number, total: number) => (total ? count / total : 0);
  return {
    coverageAt1: ratio(
      labelled.filter((item) => hit(item, 1)).length,
      labelled.length,
    ),
    coverageAt3: ratio(
      labelled.filter((item) => hit(item, 3)).length,
      labelled.length,
    ),
    precisionAt1: ratio(
      labelled.filter((item) => hit(item, 1)).length,
      labelled.length,
    ),
    recallAt3: ratio(
      labelled.filter((item) => hit(item, 3)).length,
      labelled.length,
    ),
    acceptanceRate: ratio(
      outcomes.filter((item) => item.accepted).length,
      outcomes.length,
    ),
    correctionRate: ratio(
      outcomes.filter((item) => item.corrected).length,
      outcomes.length,
    ),
    ambiguityRate: ratio(
      outcomes.filter((item) => item.ambiguous).length,
      outcomes.length,
    ),
    noCandidateRate: ratio(
      outcomes.filter((item) => item.candidateIds.length === 0).length,
      outcomes.length,
    ),
  };
}

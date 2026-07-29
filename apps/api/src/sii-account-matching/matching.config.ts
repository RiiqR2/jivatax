export const MATCHING_CONFIG = Object.freeze({
  algorithmVersion: "deterministic-v1",
  topCandidates: 3,
  scores: {
    exactOfficial: 45,
    exactAlias: 35,
    partial: 20,
    relevantWord: 6,
    companyAlias: 60,
    negativeTerm: -30,
  },
  confidence: { high: 0.8, medium: 0.55 },
  minimumScore: 12,
  scoreForFullConfidence: 85,
  distanceForFullConfidence: 30,
});

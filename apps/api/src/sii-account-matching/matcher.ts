import { MATCHING_CONFIG } from "./matching.config";
import {
  normalizeAccountTerm,
  relevantWords,
} from "./normalization/account-term-normalizer";

export type MatchTerm = {
  term: string;
  normalizedTerm?: string;
  type: string;
  weight: number;
  companyId?: string | null;
};
export type MatchAccount = {
  id: string;
  code: string;
  name: string;
  terms: MatchTerm[];
};
export type MatchReason = {
  signal: string;
  description: string;
  points: number;
};
export type MatchCandidate = MatchAccount & {
  score: number;
  confidence: number;
  reasons: MatchReason[];
};

export function rankSiiAccounts(
  name: string,
  companyId: string,
  accounts: MatchAccount[],
): MatchCandidate[] {
  const normalized = normalizeAccountTerm(name);
  const words = relevantWords(name);
  const ranked = accounts
    .map((account) => {
      const reasons: MatchReason[] = [];
      const official = normalizeAccountTerm(account.name);
      if (official === normalized)
        reasons.push({
          signal: "exact_official",
          description: "Coincidencia exacta con el nombre oficial",
          points: MATCHING_CONFIG.scores.exactOfficial,
        });
      else if (official.includes(normalized) || normalized.includes(official))
        reasons.push({
          signal: "partial",
          description: "Coincidencia parcial con el nombre oficial",
          points: MATCHING_CONFIG.scores.partial,
        });
      const overlap = [...words].filter((word) =>
        relevantWords(account.name).has(word),
      ).length;
      if (overlap)
        reasons.push({
          signal: "relevant_words",
          description: `${overlap} palabra(s) relevante(s) coinciden`,
          points: overlap * MATCHING_CONFIG.scores.relevantWord,
        });
      for (const term of account.terms.filter(
        (item) => item.companyId == null || item.companyId === companyId,
      )) {
        const termNormalized =
          term.normalizedTerm || normalizeAccountTerm(term.term);
        const exact = termNormalized === normalized;
        const partial =
          termNormalized.length >= 4 &&
          (normalized.includes(termNormalized) ||
            termNormalized.includes(normalized));
        if (term.type === "negative_term" && (exact || partial))
          reasons.push({
            signal: "negative_term",
            description: `Término negativo: ${term.term}`,
            points: term.weight || MATCHING_CONFIG.scores.negativeTerm,
          });
        else if (exact && term.companyId === companyId)
          reasons.push({
            signal: "company_history",
            description: "Alias aprendido de una homologación de esta empresa",
            points: MATCHING_CONFIG.scores.companyAlias,
          });
        else if (exact && term.type !== "official_name")
          reasons.push({
            signal: "alias",
            description: `Coincidencia exacta con alias: ${term.term}`,
            points: term.weight || MATCHING_CONFIG.scores.exactAlias,
          });
        else if (partial && term.type !== "official_name")
          reasons.push({
            signal: "partial_alias",
            description: `Coincidencia parcial con término: ${term.term}`,
            points: Math.min(term.weight, MATCHING_CONFIG.scores.partial),
          });
      }
      return {
        ...account,
        score: reasons.reduce((sum, reason) => sum + reason.points, 0),
        confidence: 0,
        reasons,
      };
    })
    .filter((candidate) => candidate.score >= MATCHING_CONFIG.minimumScore)
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
  const secondScore = ranked[1]?.score ?? 0;
  return ranked
    .slice(0, MATCHING_CONFIG.topCandidates)
    .map((candidate, index) => ({
      ...candidate,
      confidence: Math.max(
        0,
        Math.min(
          1,
          (candidate.score / MATCHING_CONFIG.scoreForFullConfidence) *
            ((candidate.score - (index === 0 ? secondScore : 0)) /
              MATCHING_CONFIG.distanceForFullConfidence),
        ),
      ),
    }));
}

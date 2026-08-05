import { ACCOUNT_SUGGESTION_CONFIG } from "../account-suggestion.config";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import {
  normalizeAccountTerm,
  relevantWords,
  weightedTokenSimilarity,
} from "../normalization/account-term-normalizer";

export function exactTermWeight(term: SiiAccountTermEntity): number {
  const weights = ACCOUNT_SUGGESTION_CONFIG.weights;
  if (term.scope === "company") return weights.exactCompanyAlias;
  return (
    (
      {
        official_name: weights.exactOfficialName,
        alias: weights.exactAlias,
        erp_term: weights.exactErpTerm,
        abbreviation: weights.exactAbbreviation,
        manual_term: weights.exactManualTerm,
        industry_term: weights.exactIndustryTerm,
      } as Partial<Record<SiiAccountTermEntity["type"], number>>
    )[term.type] ?? Number(term.weight)
  );
}

export function exactTermSignal(term: SiiAccountTermEntity): string {
  if (term.scope === "company") return "exact_company_alias";
  return `exact_${term.type}`;
}

export function lexicalSimilarity(left: string, right: string): number {
  if (!left || !right) return 0;
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let column = 1; column <= right.length; column++) {
    let previous = rows[0];
    rows[0] = column;
    for (let row = 1; row <= left.length; row++) {
      const saved = rows[row];
      rows[row] = Math.min(
        rows[row] + 1,
        rows[row - 1] + 1,
        previous + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
      previous = saved;
    }
  }
  return 1 - rows[left.length] / Math.max(left.length, right.length);
}

export function termOccurs(name: string, term: string): boolean {
  if (!term) return false;
  const nameWords = relevantWords(name);
  const termWords = relevantWords(term);
  return (
    termWords.size > 0 && [...termWords].every((word) => nameWords.has(word))
  );
}

export function negativeTermMatches(
  normalizedSource: string,
  normalizedTerm: string,
): boolean {
  return (
    normalizedSource === normalizedTerm ||
    termOccurs(normalizedSource, normalizedTerm)
  );
}

export function partialTermSimilarity(
  normalizedSource: string,
  rawTerm: string,
): { token: number; lexical: number } {
  const normalizedTerm = normalizeAccountTerm(rawTerm);
  return {
    token: weightedTokenSimilarity(normalizedSource, normalizedTerm),
    lexical: lexicalSimilarity(normalizedSource, normalizedTerm),
  };
}

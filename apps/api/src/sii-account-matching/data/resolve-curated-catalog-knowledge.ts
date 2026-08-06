import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import type { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import { normalizeAccountConcept } from "../normalization/account-concept-normalizer";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import { SII_ACCOUNT_ALIASES } from "./sii-account-aliases";
import { SII_ACCOUNT_CONCEPTS } from "./sii-account-concepts";

export type CuratedCatalogKnowledge = {
  terms: Map<string, SiiAccountTermEntity[]>;
  negativeTerms: Map<string, SiiAccountTermEntity[]>;
  concepts: Map<string, SiiAccountConceptEntity[]>;
  missingCodes: string[];
};

/** Binds curated aliases and concepts to the active catalogue UUIDs by stable SII code. */
export function resolveCuratedCatalogKnowledge(
  accounts: SiiAccountEntity[],
): CuratedCatalogKnowledge {
  const byCode = new Map(accounts.map((account) => [account.code, account]));
  const terms = new Map<string, SiiAccountTermEntity[]>();
  const negativeTerms = new Map<string, SiiAccountTermEntity[]>();
  const concepts = new Map<string, SiiAccountConceptEntity[]>();
  const missingCodes: string[] = [];

  for (const entry of SII_ACCOUNT_ALIASES) {
    const account = byCode.get(entry.siiAccountCode);
    if (!account) {
      missingCodes.push(entry.siiAccountCode);
      continue;
    }
    for (const item of entry.terms) {
      const resolved = {
        siiAccountId: account.id,
        term: item.term,
        normalizedTerm: normalizeAccountTerm(item.term),
        type: item.type,
        weight: item.weight,
        scope: "global",
        companyId: null,
        active: true,
        deletedAt: null,
        source: "curated_catalog",
      } as SiiAccountTermEntity;
      const bucket = item.type === "negative_term" ? negativeTerms : terms;
      bucket.set(account.id, [...(bucket.get(account.id) ?? []), resolved]);
    }
  }

  for (const entry of SII_ACCOUNT_CONCEPTS) {
    const account = byCode.get(entry.siiAccountCode);
    if (!account) {
      missingCodes.push(entry.siiAccountCode);
      continue;
    }
    concepts.set(account.id, [
      ...(concepts.get(account.id) ?? []),
      ...entry.concepts.map(
        (item) =>
          ({
            siiAccountId: account.id,
            concept: item.concept,
            normalizedConcept: normalizeAccountConcept(item.concept),
            conceptType: item.type,
            weight: item.weight,
            active: true,
            deletedAt: null,
          }) as SiiAccountConceptEntity,
      ),
    ]);
  }

  return {
    terms,
    negativeTerms,
    concepts,
    missingCodes: [...new Set(missingCodes)],
  };
}

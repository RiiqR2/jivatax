import type { SiiAccountTermType } from "../entities/sii-account-term.entity";

export type CuratedSiiAccountKnowledge = {
  siiAccountCode: string;
  terms: ReadonlyArray<{
    term: string;
    type: Exclude<SiiAccountTermType, "official_name">;
    weight: number;
  }>;
};

/**
 * Reviewed aliases keyed only by stable SII code. Add entries after checking the
 * currently imported official catalogue; never use UUIDs or MiPyme codes here.
 */
export const SII_ACCOUNT_ALIASES: readonly CuratedSiiAccountKnowledge[] = [];

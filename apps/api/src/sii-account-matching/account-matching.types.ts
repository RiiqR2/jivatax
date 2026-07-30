import type { SiiAccountEntity } from "../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountTermEntity } from "./entities/sii-account-term.entity";
import type { SiiAccountConceptEntity } from "./entities/sii-account-concept.entity";

export type StatementSection =
  "asset" | "liability" | "equity" | "income" | "expense";
export type BalanceNature = "debit" | "credit";
export type AccountTerm = "current" | "non_current";

export interface AccountingMetadata {
  family: string;
  statementSection: StatementSection;
  expectedBalanceNature: BalanceNature;
  term?: AccountTerm;
  contraAccount: boolean;
  concepts: string[];
}

export interface BalanceContext {
  assetAmount: string;
  liabilityAmount: string;
  lossAmount: string;
  gainAmount: string;
  debitBalance: string;
  creditBalance: string;
}

export interface GeneratedCandidate {
  account: SiiAccountEntity;
  metadata: AccountingMetadata;
  terms: SiiAccountTermEntity[];
  concepts: SiiAccountConceptEntity[];
}

export interface RankedCandidate extends GeneratedCandidate {
  score: number;
  confidence: number;
  reasons: Array<{ signal: string; description: string; points: number }>;
}

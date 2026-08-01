import type { SiiAccountEntity } from "../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountTermEntity } from "./entities/sii-account-term.entity";
import type { SiiAccountConceptEntity } from "./entities/sii-account-concept.entity";
import type { SiiAccountKnowledgeEntity } from "./entities/sii-account-knowledge.entity";
import type { AccountMatchingLearningEntity } from "./entities/account-matching-learning.entity";
import type { AccountMatchingLearningIndustryEntity } from "./entities/account-matching-learning-industry.entity";

export type AccountLearningEvidence = AccountMatchingLearningEntity & {
  industryEvidence?: AccountMatchingLearningIndustryEntity;
};

export type StatementSection =
  "asset" | "liability" | "equity" | "income" | "expense" | "unknown";
export type ObservedAccountSection =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense"
  | "contra_asset"
  | "contra_liability"
  | "unknown";
export type BalanceNature = "debit" | "credit";
export type AccountTerm = "current" | "non_current";

export interface AccountingMetadata {
  family: string;
  statementSection: StatementSection;
  expectedBalanceNature: BalanceNature;
  term?: AccountTerm;
  contraAccount: boolean;
  concepts: string[];
  statementSectionSource?:
    "official_metadata" | "code_hierarchy" | "knowledge" | "text_heuristic";
}

export interface AccountNameContext {
  observedAccountName: string;
  canonicalAccountName?: string;
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
  knowledge?: SiiAccountKnowledgeEntity;
  learning?: AccountLearningEvidence[];
}

export type MatchingSignalKind = "evidence" | "penalty" | "rule";

export interface MatchingSignal {
  signal: string;
  description: string;
  points: number;
  kind: MatchingSignalKind;
  source: "lexical" | "knowledge" | "balance" | "history" | "rule";
  ruleId?: string;
}

export interface RankedCandidate extends GeneratedCandidate {
  score: number;
  confidence: number;
  reasons: MatchingSignal[];
  semanticEvidenceSatisfied: boolean;
  semanticEvidenceReasons: string[];
}

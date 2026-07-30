import { Injectable } from "@nestjs/common";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import type { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import { accountingMetadata } from "../metadata/accounting-metadata";
import type { GeneratedCandidate } from "../account-matching.types";
import { resolveCatalogExpenseKnowledge } from "../data/catalog-expense-knowledge";

/** Retrieval only: every active catalogue account enters the ranking pool. */
@Injectable()
export class AccountCandidateGeneratorService {
  generate(
    accounts: SiiAccountEntity[],
    terms: SiiAccountTermEntity[],
    concepts: SiiAccountConceptEntity[] = [],
  ): GeneratedCandidate[] {
    const catalogKnowledge = resolveCatalogExpenseKnowledge(accounts);
    const byAccount = new Map<string, SiiAccountTermEntity[]>();
    for (const term of terms) {
      if (!term.active || term.deletedAt || term.type === "negative_term")
        continue;
      byAccount.set(term.siiAccountId, [
        ...(byAccount.get(term.siiAccountId) ?? []),
        term,
      ]);
    }
    const conceptsByAccount = new Map<string, SiiAccountConceptEntity[]>();
    for (const concept of concepts) {
      if (!concept.active || concept.deletedAt) continue;
      conceptsByAccount.set(concept.siiAccountId, [
        ...(conceptsByAccount.get(concept.siiAccountId) ?? []),
        concept,
      ]);
    }
    return accounts
      .filter((account) => !account.deletedAt)
      .map((account) => ({
        account,
        metadata: accountingMetadata(account.name),
        terms: [
          ...(byAccount.get(account.id) ?? []),
          ...(catalogKnowledge.terms.get(account.id) ?? []),
        ],
        concepts: [
          ...(conceptsByAccount.get(account.id) ?? []),
          ...(catalogKnowledge.concepts.get(account.id) ?? []),
        ],
      }));
  }
}

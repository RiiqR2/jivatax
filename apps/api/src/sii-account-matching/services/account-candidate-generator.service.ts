import { Injectable } from "@nestjs/common";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import type { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import { accountingMetadata } from "../metadata/accounting-metadata";
import type { GeneratedCandidate } from "../account-matching.types";
import { resolveCatalogExpenseKnowledge } from "../data/catalog-expense-knowledge";
import type { SiiAccountKnowledgeEntity } from "../entities/sii-account-knowledge.entity";
import type { AccountLearningEvidence } from "../account-matching.types";

/** Retrieval only: every active catalogue account enters the ranking pool. */
@Injectable()
export class AccountCandidateGeneratorService {
  generate(
    accounts: SiiAccountEntity[],
    terms: SiiAccountTermEntity[] = [],
    concepts: SiiAccountConceptEntity[] = [],
    knowledge: SiiAccountKnowledgeEntity[] = [],
    learning: AccountLearningEvidence[] = [],
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
    const knowledgeByAccount = new Map(
      knowledge
        .filter((item) => item.active && !item.deletedAt)
        .map((item) => [item.siiAccountId, item]),
    );
    const learningByAccount = new Map<string, AccountLearningEvidence[]>();
    for (const item of learning.filter((item) => !item.deletedAt))
      learningByAccount.set(item.siiAccountId, [
        ...(learningByAccount.get(item.siiAccountId) ?? []),
        item,
      ]);
    return accounts
      .filter((account) => !account.deletedAt)
      .map((account) => ({
        account,
        metadata: this.resolveMetadata(
          account,
          knowledgeByAccount.get(account.id),
        ),
        knowledge: knowledgeByAccount.get(account.id),
        learning: learningByAccount.get(account.id) ?? [],
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

  private resolveMetadata(
    account: SiiAccountEntity,
    knowledge?: SiiAccountKnowledgeEntity,
  ) {
    const inferred = accountingMetadata(account.name);
    const official = this.officialStatementSection(account.rawData);
    const hierarchy = account.code.startsWith("1.") ? "asset" : undefined;
    const statementSection =
      official ??
      hierarchy ??
      knowledge?.statementSection ??
      inferred.statementSection;
    const statementSectionSource = official
      ? ("official_metadata" as const)
      : hierarchy
        ? ("code_hierarchy" as const)
        : knowledge
          ? ("knowledge" as const)
          : ("text_heuristic" as const);
    const expectedBalanceNature =
      official || hierarchy
        ? inferred.contraAccount ||
          statementSection === "liability" ||
          statementSection === "equity" ||
          statementSection === "income"
          ? ("credit" as const)
          : ("debit" as const)
        : (knowledge?.balanceNature ?? inferred.expectedBalanceNature);
    if (!knowledge)
      return {
        ...inferred,
        statementSection,
        statementSectionSource,
        expectedBalanceNature,
      };
    return {
      ...inferred,
      family: knowledge.accountingFamily,
      statementSection,
      statementSectionSource,
      expectedBalanceNature,
      term:
        knowledge.isCurrent == null
          ? inferred.term
          : knowledge.isCurrent
            ? ("current" as const)
            : ("non_current" as const),
      contraAccount: knowledge.isContraAccount,
    };
  }

  private officialStatementSection(rawData: Record<string, unknown> | null) {
    const source = rawData?.sourceColumns;
    if (!source || typeof source !== "object") return undefined;
    const values = Object.entries(source as Record<string, unknown>)
      .filter(([key]) => /secci|clasific|estado|rubro|tipo/i.test(key))
      .map(([, value]) => String(value).toLowerCase());
    if (values.some((value) => /activo/.test(value))) return "asset" as const;
    if (values.some((value) => /pasivo/.test(value)))
      return "liability" as const;
    if (values.some((value) => /patrimonio/.test(value)))
      return "equity" as const;
    if (values.some((value) => /ingreso|ganancia/.test(value)))
      return "income" as const;
    if (values.some((value) => /gasto|costo|perdida|resultado/.test(value)))
      return "expense" as const;
    return undefined;
  }
}

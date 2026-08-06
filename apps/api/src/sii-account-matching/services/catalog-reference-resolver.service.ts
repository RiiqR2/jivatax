import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, In } from "typeorm";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountEntity as SiiAccountOrmEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import type { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import type { SiiAccountKnowledgeEntity } from "../entities/sii-account-knowledge.entity";
import type { AccountLearningEvidence } from "../account-matching.types";

export type OrphanCatalogReference = {
  source: "term" | "concept" | "knowledge" | "learning";
  siiAccountId: string;
  stableCode: string | null;
  detail?: string;
};

export type ResolvedCatalogReferences = {
  terms: SiiAccountTermEntity[];
  concepts: SiiAccountConceptEntity[];
  knowledge: SiiAccountKnowledgeEntity[];
  learning: AccountLearningEvidence[];
  orphans: OrphanCatalogReference[];
  remappedCount: number;
};

@Injectable()
export class CatalogReferenceResolverService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async resolve(input: {
    terms: SiiAccountTermEntity[];
    concepts: SiiAccountConceptEntity[];
    knowledge: SiiAccountKnowledgeEntity[];
    learning: AccountLearningEvidence[];
    currentAccounts: SiiAccountEntity[];
  }): Promise<ResolvedCatalogReferences> {
    const currentIds = new Set(
      input.currentAccounts.map((account) => account.id),
    );
    const currentByCode = new Map(
      input.currentAccounts.map((account) => [account.code, account.id]),
    );
    const referencedIds = [
      ...new Set([
        ...input.terms.map((item) => item.siiAccountId),
        ...input.concepts.map((item) => item.siiAccountId),
        ...input.knowledge.map((item) => item.siiAccountId),
        ...input.learning.map((item) => item.siiAccountId),
      ]),
    ].filter((id) => !currentIds.has(id));

    const codeById = referencedIds.length
      ? new Map(
          (
            await this.dataSource.getRepository(SiiAccountOrmEntity).find({
              where: { id: In(referencedIds) },
              select: { id: true, code: true },
            })
          ).map((row) => [row.id, row.code]),
        )
      : new Map<string, string>();

    let remappedCount = 0;
    const orphans: OrphanCatalogReference[] = [];

    const remapId = (
      siiAccountId: string,
      source: OrphanCatalogReference["source"],
      detail?: string,
    ) => {
      if (currentIds.has(siiAccountId)) return siiAccountId;
      const code = codeById.get(siiAccountId) ?? null;
      const resolved = code ? currentByCode.get(code) : undefined;
      if (resolved) {
        remappedCount++;
        return resolved;
      }
      orphans.push({ source, siiAccountId, stableCode: code, detail });
      return null;
    };

    const terms = input.terms.flatMap((term) => {
      const resolvedId = remapId(
        term.siiAccountId,
        "term",
        term.normalizedTerm,
      );
      return resolvedId ? [{ ...term, siiAccountId: resolvedId }] : [];
    });
    const concepts = input.concepts.flatMap((concept) => {
      const resolvedId = remapId(
        concept.siiAccountId,
        "concept",
        concept.normalizedConcept || concept.concept,
      );
      return resolvedId ? [{ ...concept, siiAccountId: resolvedId }] : [];
    });
    const knowledge = input.knowledge.flatMap((item) => {
      const resolvedId = remapId(item.siiAccountId, "knowledge");
      return resolvedId ? [{ ...item, siiAccountId: resolvedId }] : [];
    });
    const learning = input.learning.flatMap((item) => {
      const resolvedId = remapId(item.siiAccountId, "learning");
      return resolvedId ? [{ ...item, siiAccountId: resolvedId }] : [];
    });

    return { terms, concepts, knowledge, learning, orphans, remappedCount };
  }
}

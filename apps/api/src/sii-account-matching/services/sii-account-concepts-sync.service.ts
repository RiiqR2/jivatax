import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, In } from "typeorm";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountPlanVersionStatus } from "../../sii-account-plan/enums/sii-account-plan-version-status.enum";
import {
  SII_ACCOUNT_CONCEPTS,
  type CuratedSiiAccountConcepts,
} from "../data/sii-account-concepts";
import { deriveConceptsFromSiiAccount } from "../derivation/sii-account-concept-deriver";
import {
  SiiAccountConceptEntity,
  type SiiAccountConceptType,
} from "../entities/sii-account-concept.entity";
import { normalizeAccountConcept } from "../normalization/account-concept-normalizer";

export type ConceptsSyncSummary = {
  totalSiiAccountsInDatabase: number;
  versionsFound: number;
  selectedVersionId: string;
  selectedVersionLabel: string;
  curatedConceptsConfigured: number;
  derivedConceptsConfigured: number;
  curatedConceptsCreated: number;
  derivedConceptsCreated: number;
  existingConceptsSkipped: number;
  inactiveConceptsSkipped: number;
  accountsWithoutConcepts: string[];
  missingReferencedAccounts: string[];
  errors: number;
};

type ConceptCandidate = {
  account: SiiAccountEntity;
  concept: string;
  type: SiiAccountConceptType;
  weight: number;
  source: "jivatax_curated" | "catalog_derived";
};

const identity = (
  siiAccountId: string,
  normalizedConcept: string,
  type: SiiAccountConceptType,
  source: string,
) => `${siiAccountId}\u0000${normalizedConcept}\u0000${type}\u0000${source}`;

@Injectable()
export class SiiAccountConceptsSyncService {
  private readonly logger = new Logger(SiiAccountConceptsSyncService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async synchronize(
    knowledge: readonly CuratedSiiAccountConcepts[] = SII_ACCOUNT_CONCEPTS,
  ): Promise<ConceptsSyncSummary> {
    return this.dataSource.transaction(async (manager) => {
      const accountsRepository = manager.getRepository(SiiAccountEntity);
      const versionsRepository = manager.getRepository(
        SiiAccountPlanVersionEntity,
      );
      const conceptsRepository = manager.getRepository(SiiAccountConceptEntity);
      const [total, versions] = await Promise.all([
        accountsRepository.count(),
        versionsRepository.find({ order: { importedAt: "DESC" } }),
      ]);
      const version =
        versions.find(
          (item) => item.status === SiiAccountPlanVersionStatus.ACTIVE,
        ) ?? versions[0];
      if (!version)
        throw new Error(
          `No se encontró una versión del catálogo SII (${total} cuentas en sii_accounts).`,
        );
      const accounts = await accountsRepository.find({
        where: { versionId: version.id },
        order: { sortOrder: "ASC" },
      });
      if (total > 0 && !accounts.length)
        throw new Error(
          `La versión SII seleccionada ${version.id} no contiene cuentas.`,
        );

      const summary: ConceptsSyncSummary = {
        totalSiiAccountsInDatabase: total,
        versionsFound: versions.length,
        selectedVersionId: version.id,
        selectedVersionLabel: `${version.code} · ${version.name}`,
        curatedConceptsConfigured: 0,
        derivedConceptsConfigured: 0,
        curatedConceptsCreated: 0,
        derivedConceptsCreated: 0,
        existingConceptsSkipped: 0,
        inactiveConceptsSkipped: 0,
        accountsWithoutConcepts: [],
        missingReferencedAccounts: [],
        errors: 0,
      };
      const byCode = new Map(
        accounts.map((account) => [account.code, account]),
      );
      const curatedByCode = new Map(
        knowledge.map((entry) => [entry.siiAccountCode, entry.concepts]),
      );
      for (const entry of knowledge) {
        if (byCode.has(entry.siiAccountCode)) continue;
        summary.missingReferencedAccounts.push(entry.siiAccountCode);
        this.logger.warn(
          `No existe cuenta SII activa referenciada: ${entry.siiAccountCode}`,
        );
      }

      const candidates: ConceptCandidate[] = [];
      for (const account of accounts) {
        const curated = curatedByCode.get(account.code) ?? [];
        const derived = deriveConceptsFromSiiAccount(account);
        summary.curatedConceptsConfigured += curated.length;
        summary.derivedConceptsConfigured += derived.length;
        if (!curated.length && !derived.length) {
          summary.accountsWithoutConcepts.push(account.code);
          this.logger.warn(
            `Cuenta SII sin conceptos curados ni derivados: ${account.code} · ${account.name}`,
          );
        }
        candidates.push(
          ...curated.map((item) => ({
            account,
            concept: item.concept,
            type: item.type,
            weight: item.weight,
            source: "jivatax_curated" as const,
          })),
          ...derived.map((item) => ({
            account,
            concept: item.concept,
            type: item.type,
            weight: item.weight,
            source: "catalog_derived" as const,
          })),
        );
      }

      const existing = accounts.length
        ? await conceptsRepository.find({
            where: { siiAccountId: In(accounts.map((account) => account.id)) },
            withDeleted: true,
          })
        : [];
      const existingByIdentity = new Map(
        existing.map((item) => [
          identity(
            item.siiAccountId,
            item.normalizedConcept,
            item.conceptType,
            item.source,
          ),
          item,
        ]),
      );
      const pending: SiiAccountConceptEntity[] = [];
      const pendingIdentities = new Set<string>();
      for (const candidate of candidates) {
        const normalizedConcept = normalizeAccountConcept(candidate.concept);
        const key = identity(
          candidate.account.id,
          normalizedConcept,
          candidate.type,
          candidate.source,
        );
        const found = existingByIdentity.get(key);
        if (found || pendingIdentities.has(key)) {
          if (!found || found.active) summary.existingConceptsSkipped++;
          else summary.inactiveConceptsSkipped++;
          continue;
        }
        pendingIdentities.add(key);
        pending.push(
          conceptsRepository.create({
            siiAccountId: candidate.account.id,
            concept: candidate.concept,
            normalizedConcept,
            conceptType: candidate.type,
            weight: candidate.weight,
            source: candidate.source,
            active: true,
          }),
        );
        if (candidate.source === "jivatax_curated")
          summary.curatedConceptsCreated++;
        else summary.derivedConceptsCreated++;
      }
      if (pending.length) {
        try {
          await conceptsRepository.save(pending);
        } catch (error) {
          summary.errors++;
          this.logger.error(
            "Error guardando lote de conceptos SII",
            error instanceof Error ? error.stack : String(error),
          );
          throw error;
        }
      }
      return summary;
    });
  }
}

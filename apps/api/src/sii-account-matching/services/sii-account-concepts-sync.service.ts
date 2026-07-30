import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountPlanVersionStatus } from "../../sii-account-plan/enums/sii-account-plan-version-status.enum";
import {
  SII_ACCOUNT_CONCEPTS,
  type CuratedSiiAccountConcepts,
} from "../data/sii-account-concepts";
import { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import { normalizeAccountConcept } from "../normalization/account-concept-normalizer";

export type ConceptsSyncSummary = {
  totalSiiAccountsInDatabase: number;
  versionsFound: number;
  selectedVersionId: string;
  selectedVersionLabel: string;
  conceptsConfigured: number;
  conceptsCreated: number;
  existingConceptsSkipped: number;
  inactiveConceptsSkipped: number;
  missingReferencedAccounts: string[];
  errors: number;
};

@Injectable()
export class SiiAccountConceptsSyncService {
  private readonly logger = new Logger(SiiAccountConceptsSyncService.name);

  constructor(
    @InjectRepository(SiiAccountEntity)
    private readonly accounts: Repository<SiiAccountEntity>,
    @InjectRepository(SiiAccountPlanVersionEntity)
    private readonly versions: Repository<SiiAccountPlanVersionEntity>,
    @InjectRepository(SiiAccountConceptEntity)
    private readonly concepts: Repository<SiiAccountConceptEntity>,
  ) {}

  async synchronize(
    knowledge: readonly CuratedSiiAccountConcepts[] = SII_ACCOUNT_CONCEPTS,
  ): Promise<ConceptsSyncSummary> {
    const [total, versions] = await Promise.all([
      this.accounts.count(),
      this.versions.find({ order: { importedAt: "DESC" } }),
    ]);
    const version =
      versions.find(
        (item) => item.status === SiiAccountPlanVersionStatus.ACTIVE,
      ) ?? versions[0];
    if (!version)
      throw new Error(
        `No se encontró una versión del catálogo SII (${total} cuentas en sii_accounts).`,
      );
    const accounts = await this.accounts.find({
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
      conceptsConfigured: knowledge.reduce(
        (sum, item) => sum + item.concepts.length,
        0,
      ),
      conceptsCreated: 0,
      existingConceptsSkipped: 0,
      inactiveConceptsSkipped: 0,
      missingReferencedAccounts: [],
      errors: 0,
    };
    const byCode = new Map(accounts.map((account) => [account.code, account]));
    for (const entry of knowledge) {
      const account = byCode.get(entry.siiAccountCode);
      if (!account) {
        summary.missingReferencedAccounts.push(entry.siiAccountCode);
        this.logger.warn(
          `No existe cuenta SII activa referenciada: ${entry.siiAccountCode}`,
        );
        continue;
      }
      for (const configured of entry.concepts) {
        const normalizedConcept = normalizeAccountConcept(configured.concept);
        try {
          const existing = await this.concepts.findOne({
            where: {
              siiAccountId: account.id,
              normalizedConcept,
              conceptType: configured.type,
              source: "jivatax_curated",
            },
            withDeleted: true,
          });
          if (existing) {
            if (existing.active) summary.existingConceptsSkipped++;
            else summary.inactiveConceptsSkipped++;
            continue;
          }
          await this.concepts.save(
            this.concepts.create({
              siiAccountId: account.id,
              concept: configured.concept,
              normalizedConcept,
              conceptType: configured.type,
              weight: configured.weight,
              source: "jivatax_curated",
              active: true,
            }),
          );
          summary.conceptsCreated++;
        } catch (error) {
          summary.errors++;
          this.logger.error(
            `Error sincronizando ${entry.siiAccountCode}/${configured.concept}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
    }
    return summary;
  }
}

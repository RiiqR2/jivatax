import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountPlanVersionStatus } from "../../sii-account-plan/enums/sii-account-plan-version-status.enum";
import {
  CURATED_APPLICABILITY_MATRIX_VERSION,
  CURATED_APPLICABILITY_SOURCE_ROWS,
} from "../data/curated-applicability-matrix";
import {
  APPLICABILITY_ONLY_ROLE,
  compileCuratedApplicability,
  type CuratedApplicabilityReport,
} from "../data/compile-curated-applicability";
import { WorkPaperApplicabilityEntity } from "../entities/work-paper-applicability.entity";
import { WorkPaperDefinitionEntity } from "../entities/work-paper-definition.entity";
import { WorkPaperDefinitionStatus } from "../tax-work-paper.enums";

export interface CuratedApplicabilitySyncResult {
  matrixVersion: string;
  report: CuratedApplicabilityReport;
  inserted: number;
  reactivated: number;
  unchanged: number;
  skippedMissingCatalog: number;
}

/**
 * Deterministic loader for the versioned A.1–A.20 curated matrix.
 * Never invents roles, never deletes history, never touches mappings.
 */
@Injectable()
export class CuratedApplicabilitySyncService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(WorkPaperDefinitionEntity)
    private readonly definitions: Repository<WorkPaperDefinitionEntity>,
    @InjectRepository(WorkPaperApplicabilityEntity)
    private readonly applicabilities: Repository<WorkPaperApplicabilityEntity>,
  ) {}

  async loadActiveCatalogCodes(): Promise<Set<string>> {
    const rows = await this.dataSource
      .createQueryBuilder(SiiAccountEntity, "sii")
      .innerJoin(
        SiiAccountPlanVersionEntity,
        "spv",
        "spv.id = sii.version_id AND spv.status = :active AND spv.deleted_at IS NULL",
        { active: SiiAccountPlanVersionStatus.ACTIVE },
      )
      .select("sii.code", "code")
      .where("sii.deleted_at IS NULL")
      .getRawMany<{ code: string }>();
    return new Set(rows.map((row) => row.code));
  }

  async compileAgainstActiveCatalog(): Promise<CuratedApplicabilityReport> {
    return compileCuratedApplicability(
      CURATED_APPLICABILITY_SOURCE_ROWS,
      await this.loadActiveCatalogCodes(),
    );
  }

  async synchronize(): Promise<CuratedApplicabilitySyncResult> {
    const report = await this.compileAgainstActiveCatalog();
    const definitions = await this.definitions.find({
      where: { status: WorkPaperDefinitionStatus.ACTIVE, version: 1 },
    });
    const definitionByCode = new Map(
      definitions.map((definition) => [definition.code, definition]),
    );

    let inserted = 0;
    let reactivated = 0;
    let unchanged = 0;

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(WorkPaperApplicabilityEntity);
      for (const association of report.validAssociations) {
        const definition = definitionByCode.get(association.workPaperCode);
        if (!definition) continue;
        const existing = await repository.findOne({
          where: {
            definitionId: definition.id,
            siiAccountCode: association.siiAccountCode,
            roleKey: association.roleKey,
          },
          withDeleted: true,
        });
        const rationale = `curated:${CURATED_APPLICABILITY_MATRIX_VERSION};sourceRows=${association.sourceRows.join(",")}`;
        if (!existing) {
          await repository.save(
            repository.create({
              definitionId: definition.id,
              siiAccountCode: association.siiAccountCode,
              legacySiiAccountId: null,
              roleKey: association.roleKey,
              rationale,
              isActive: true,
            }),
          );
          inserted++;
          continue;
        }
        if (existing.deletedAt != null || !existing.isActive) {
          existing.deletedAt = null;
          existing.isActive = true;
          existing.rationale = rationale;
          await repository.save(existing);
          reactivated++;
          continue;
        }
        if (existing.rationale !== rationale) {
          existing.rationale = rationale;
          await repository.save(existing);
        }
        unchanged++;
      }
    });

    return {
      matrixVersion: CURATED_APPLICABILITY_MATRIX_VERSION,
      report,
      inserted,
      reactivated,
      unchanged,
      skippedMissingCatalog: report.missingCatalogCodes.length,
    };
  }

  /** Convenience for tests asserting the default role policy. */
  static defaultRoleKey(): string {
    return APPLICABILITY_ONLY_ROLE;
  }
}

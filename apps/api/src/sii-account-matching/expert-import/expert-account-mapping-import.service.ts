import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { DataSource, In, IsNull } from "typeorm";
import { NormalizationService } from "../../common/services/normalization.service";
import { IndustryEntity } from "../../industries/entities/industry.entity";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountPlanVersionStatus } from "../../sii-account-plan/enums/sii-account-plan-version-status.enum";
import { UserEntity } from "../../users/entities/user.entity";
import {
  AccountMatchingConfirmationEntity,
  ConfirmationSource,
} from "../entities/account-matching-confirmation.entity";
import { LearningAggregatorService } from "../services/learning-aggregator.service";
import { ExpertAccountMappingFileParser } from "./expert-account-mapping-file.parser";
import type {
  ExpertImportRejection,
  ExpertImportReport,
  ExpertMappingRow,
} from "./expert-account-mapping.types";

export interface ExpertImportOptions {
  file: string;
  sheet?: string;
  dryRun?: boolean;
  industryId?: string;
  confirmedByUserId?: string;
  rebuild?: boolean;
}
@Injectable()
export class ExpertAccountMappingImportService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly normalization: NormalizationService,
    private readonly aggregator: LearningAggregatorService,
  ) {}
  async import(options: ExpertImportOptions): Promise<ExpertImportReport> {
    const started = new Date();
    const parsed = await new ExpertAccountMappingFileParser().parse(
      options.file,
      options.sheet,
    );
    const fileHash = createHash("sha256").update(parsed.bytes).digest("hex");
    const rejection: ExpertImportRejection[] = [];
    const reject = (
      row: ExpertMappingRow,
      reasonCode: ExpertImportRejection["reasonCode"],
      message: string,
    ) => rejection.push({ ...row, reasonCode, message });
    if (options.industryId) {
      const industry = await this.dataSource
        .getRepository(IndustryEntity)
        .findOneBy({
          id: options.industryId,
          isActive: true,
          deletedAt: IsNull(),
        });
      if (!industry)
        for (const row of parsed.rows)
          reject(
            row,
            "INVALID_INDUSTRY",
            "El rubro no existe o está inactivo.",
          );
    }
    if (
      options.confirmedByUserId &&
      !(await this.dataSource
        .getRepository(UserEntity)
        .existsBy({ id: options.confirmedByUserId, deletedAt: IsNull() }))
    ) {
      for (const row of parsed.rows)
        reject(
          row,
          "INVALID_CONFIRMED_BY_USER",
          "El usuario confirmador no existe.",
        );
    }
    const structurallyValid = parsed.rows.filter((row) => {
      if (!row.originalName) {
        reject(
          row,
          "MISSING_INTERNAL_NAME",
          "El nombre interno es obligatorio.",
        );
        return false;
      }
      if (!row.siiCode) {
        reject(row, "MISSING_SII_CODE", "El código SII es obligatorio.");
        return false;
      }
      return !rejection.some((item) => item.rowNumber === row.rowNumber);
    });
    const activeVersions = await this.dataSource
      .getRepository(SiiAccountPlanVersionEntity)
      .findBy({
        status: SiiAccountPlanVersionStatus.ACTIVE,
        deletedAt: IsNull(),
      });
    const accounts = activeVersions.length
      ? await this.dataSource.getRepository(SiiAccountEntity).findBy({
          versionId: In(activeVersions.map((v) => v.id)),
          code: In([...new Set(structurallyValid.map((r) => r.siiCode))]),
          deletedAt: IsNull(),
        })
      : [];
    const byCode = new Map<string, SiiAccountEntity[]>();
    for (const account of accounts)
      byCode.set(account.code.trim(), [
        ...(byCode.get(account.code.trim()) ?? []),
        account,
      ]);
    const prepared: Array<{
      row: ExpertMappingRow;
      account: SiiAccountEntity;
      normalizedName: string;
      hash: string;
      reference: string;
    }> = [];
    const seen = new Set<string>();
    for (const row of structurallyValid) {
      const matches = byCode.get(row.siiCode.trim()) ?? [];
      if (!matches.length) {
        reject(
          row,
          "SII_ACCOUNT_NOT_FOUND",
          "El código no existe en el catálogo SII activo.",
        );
        continue;
      }
      if (matches.length > 1) {
        reject(
          row,
          "SII_CODE_NOT_UNIQUE",
          "El código SII está duplicado en el catálogo activo.",
        );
        continue;
      }
      const normalizedName = this.normalization.normalizeAccountName(
        row.originalName,
      );
      if (!normalizedName) {
        reject(
          row,
          "EMPTY_NORMALIZED_NAME",
          "La normalización produjo un nombre vacío.",
        );
        continue;
      }
      const hash = this.normalization.hash(normalizedName);
      const reference = this.normalization.hash(
        [
          ConfirmationSource.EXPERT,
          hash,
          matches[0].id,
          options.industryId ?? "",
        ].join(":"),
      );
      if (seen.has(reference)) {
        reject(
          row,
          "DUPLICATE_EXPERT_CONFIRMATION",
          "La fila experta está repetida en el archivo.",
        );
        continue;
      }
      seen.add(reference);
      prepared.push({
        row,
        account: matches[0],
        normalizedName,
        hash,
        reference,
      });
    }
    const existing = prepared.length
      ? await this.dataSource
          .getRepository(AccountMatchingConfirmationEntity)
          .findBy({ sourceReference: In(prepared.map((p) => p.reference)) })
      : [];
    const existingRefs = new Set(existing.map((item) => item.sourceReference));
    const newRows = prepared.filter((item) => {
      if (existingRefs.has(item.reference)) {
        reject(
          item.row,
          "DUPLICATE_EXPERT_CONFIRMATION",
          "La confirmación experta ya fue importada.",
        );
        return false;
      }
      return true;
    });
    let aggregatesRebuilt = false;
    if (!options.dryRun && newRows.length)
      await this.dataSource.transaction(async (manager) => {
        await manager.save(
          AccountMatchingConfirmationEntity,
          newRows.map((item) =>
            manager.create(AccountMatchingConfirmationEntity, {
              companyId: null,
              industryId: options.industryId ?? null,
              companyAccountId: null,
              internalAccountCode: item.row.internalAccountCode,
              originalName: item.row.originalName.trim(),
              normalizedName: item.normalizedName,
              normalizedNameHash: item.hash,
              siiAccountId: item.account.id,
              source: ConfirmationSource.EXPERT,
              sourceReference: item.reference,
              confirmedByUserId: options.confirmedByUserId ?? null,
              confirmedAt: new Date(),
              invalidatedAt: null,
              invalidatedByUserId: null,
              invalidationReason: null,
            }),
          ),
        );
        if (options.rebuild !== false) {
          await this.aggregator.rebuildWithManager(manager);
          aggregatesRebuilt = true;
        }
      });
    const duplicates = rejection.filter(
      (r) => r.reasonCode === "DUPLICATE_EXPERT_CONFIRMATION",
    );
    const rejected = rejection.length - duplicates.length;
    const completed = new Date();
    return {
      file: options.file,
      sheet: parsed.sheet,
      fileHash,
      datasetIdentifier: fileHash,
      totalRows: parsed.rows.length,
      validRows: newRows.length,
      importedRows: options.dryRun ? 0 : newRows.length,
      duplicateRows: duplicates.length,
      rejectedRows: rejected,
      unresolvedSiiCodes: [
        ...new Set(
          rejection
            .filter((r) => r.reasonCode === "SII_ACCOUNT_NOT_FOUND")
            .map((r) => r.siiCode),
        ),
      ],
      invalidNames: rejection.filter(
        (r) =>
          r.reasonCode === "MISSING_INTERNAL_NAME" ||
          r.reasonCode === "EMPTY_NORMALIZED_NAME",
      ).length,
      invalidIndustry: rejection.some(
        (r) => r.reasonCode === "INVALID_INDUSTRY",
      ),
      dryRun: options.dryRun ?? false,
      aggregatesRebuilt,
      startedAt: started.toISOString(),
      completedAt: completed.toISOString(),
      durationMs: completed.getTime() - started.getTime(),
      rejections: rejection,
    };
  }
}

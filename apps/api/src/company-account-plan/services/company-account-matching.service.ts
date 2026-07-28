import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountPlanVersionStatus } from "../../sii-account-plan/enums/sii-account-plan-version-status.enum";
import { CompanyAccountEntity } from "../entities/company-account.entity";
import { CompanyAccountMappingEntity } from "../entities/company-account-mapping.entity";
import {
  CompanyAccountMappingMethod,
  CompanyAccountMappingStatus,
} from "../enums/company-account-plan.enums";
import { normalizeAccountName } from "../utils/normalize-account-name";

interface Candidate {
  account: SiiAccountEntity;
  method: CompanyAccountMappingMethod;
  confidence: string;
}

@Injectable()
export class CompanyAccountMatchingService {
  async generateMappingSuggestions(
    manager: EntityManager,
    companyAccounts: CompanyAccountEntity[],
  ): Promise<number> {
    const activeVersion = await manager.findOne(SiiAccountPlanVersionEntity, {
      where: {
        status: SiiAccountPlanVersionStatus.ACTIVE,
      },
      order: {
        importedAt: "DESC",
      },
    });
    const siiAccounts = activeVersion
      ? await manager.findBy(SiiAccountEntity, {
          versionId: activeVersion.id,
        })
      : [];
    const codeIndex = this.indexBy(siiAccounts, (account) =>
      account.code.trim(),
    );
    const exactNameIndex = this.indexBy(siiAccounts, (account) =>
      account.name.trim().toLocaleLowerCase("es-CL"),
    );
    const normalizedNameIndex = this.indexBy(siiAccounts, (account) =>
      normalizeAccountName(account.name),
    );
    let ambiguousMappings = 0;
    const mappings = companyAccounts.map((companyAccount) => {
      const result = this.findCandidate(
        companyAccount,
        siiAccounts,
        codeIndex,
        exactNameIndex,
        normalizedNameIndex,
      );
      if (result.ambiguous) {
        ambiguousMappings += 1;
      }
      return manager.create(CompanyAccountMappingEntity, {
        companyAccountId: companyAccount.id,
        siiAccountId: result.candidate?.account.id ?? null,
        status: result.candidate
          ? CompanyAccountMappingStatus.SUGGESTED
          : CompanyAccountMappingStatus.UNMAPPED,
        mappingMethod:
          result.candidate?.method ?? CompanyAccountMappingMethod.MANUAL,
        confidence: result.candidate?.confidence ?? null,
        notes: result.ambiguous
          ? "Sugerencia omitida por existir candidatos con igual puntuación."
          : null,
        suggestedAt: result.candidate ? new Date() : null,
        reviewedAt: null,
        reviewedByUserId: null,
      });
    });
    await manager.save(CompanyAccountMappingEntity, mappings);
    return ambiguousMappings;
  }

  private findCandidate(
    companyAccount: CompanyAccountEntity,
    allAccounts: SiiAccountEntity[],
    codeIndex: Map<string, SiiAccountEntity[]>,
    exactNameIndex: Map<string, SiiAccountEntity[]>,
    normalizedNameIndex: Map<string, SiiAccountEntity[]>,
  ): { candidate: Candidate | null; ambiguous: boolean } {
    const exactCode = codeIndex.get(companyAccount.internalCode) ?? [];
    const codeResult = this.uniqueCandidate(
      exactCode,
      CompanyAccountMappingMethod.EXACT_CODE,
      "1.0000",
    );
    if (codeResult) {
      return codeResult;
    }
    const exactName =
      exactNameIndex.get(
        companyAccount.name.trim().toLocaleLowerCase("es-CL"),
      ) ?? [];
    const exactNameResult = this.uniqueCandidate(
      exactName,
      CompanyAccountMappingMethod.EXACT_NAME,
      "0.9800",
    );
    if (exactNameResult) {
      return exactNameResult;
    }
    const normalizedName = normalizeAccountName(companyAccount.name);
    const normalizedCandidates = normalizedNameIndex.get(normalizedName) ?? [];
    const normalizedResult = this.uniqueCandidate(
      normalizedCandidates,
      CompanyAccountMappingMethod.NORMALIZED_NAME,
      "0.9300",
    );
    if (normalizedResult) {
      return normalizedResult;
    }
    if (normalizedName.length >= 8) {
      const contains = allAccounts.filter((account) => {
        const candidateName = normalizeAccountName(account.name);
        return (
          candidateName.includes(normalizedName) ||
          normalizedName.includes(candidateName)
        );
      });
      const containsResult = this.uniqueCandidate(
        contains,
        CompanyAccountMappingMethod.CONTAINS_NAME,
        "0.7500",
      );
      if (containsResult) {
        return containsResult;
      }
    }
    return {
      candidate: null,
      ambiguous: false,
    };
  }

  private uniqueCandidate(
    accounts: SiiAccountEntity[],
    method: CompanyAccountMappingMethod,
    confidence: string,
  ): { candidate: Candidate | null; ambiguous: boolean } | null {
    if (!accounts.length) {
      return null;
    }
    if (accounts.length > 1) {
      return {
        candidate: null,
        ambiguous: true,
      };
    }
    return {
      candidate: {
        account: accounts[0],
        method,
        confidence,
      },
      ambiguous: false,
    };
  }

  private indexBy(
    accounts: SiiAccountEntity[],
    key: (account: SiiAccountEntity) => string,
  ): Map<string, SiiAccountEntity[]> {
    const index = new Map<string, SiiAccountEntity[]>();
    accounts.forEach((account) => {
      const value = key(account);
      index.set(value, [...(index.get(value) ?? []), account]);
    });
    return index;
  }
}

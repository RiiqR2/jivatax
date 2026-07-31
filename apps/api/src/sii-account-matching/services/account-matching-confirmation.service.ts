import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EntityManager, IsNull } from "typeorm";
import { NormalizationService } from "../../common/services/normalization.service";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import {
  AccountMatchingConfirmationEntity,
  ConfirmationSource,
} from "../entities/account-matching-confirmation.entity";

@Injectable()
export class AccountMatchingConfirmationService {
  constructor(private readonly normalization: NormalizationService) {}
  async record(
    manager: EntityManager,
    input: {
      companyId?: string;
      companyAccountId?: string;
      internalAccountCode?: string;
      originalName: string;
      siiAccountId: string;
      source: ConfirmationSource;
      userId?: string;
    },
  ) {
    const company = input.companyId
      ? await manager
          .getRepository(CompanyEntity)
          .findOneBy({ id: input.companyId, deletedAt: IsNull() })
      : null;
    if (input.companyId && !company)
      throw new NotFoundException("Empresa no encontrada.");
    if (
      !(await manager
        .getRepository(SiiAccountEntity)
        .existsBy({ id: input.siiAccountId }))
    )
      throw new NotFoundException("Cuenta SII no encontrada.");
    const normalizedName = this.normalization.normalizeAccountName(
      input.originalName,
    );
    if (!normalizedName)
      throw new BadRequestException("El nombre de cuenta es obligatorio.");
    return manager.save(
      AccountMatchingConfirmationEntity,
      manager.create(AccountMatchingConfirmationEntity, {
        companyId: company?.id ?? null,
        industryId: company?.industryId ?? null,
        companyAccountId: input.companyAccountId ?? null,
        internalAccountCode: input.internalAccountCode ?? null,
        originalName: input.originalName.trim(),
        normalizedName,
        normalizedNameHash: this.normalization.hash(normalizedName),
        siiAccountId: input.siiAccountId,
        source: input.source,
        confirmedByUserId: input.userId ?? null,
        confirmedAt: new Date(),
        invalidatedAt: null,
        invalidatedByUserId: null,
        invalidationReason: null,
      }),
    );
  }
  async invalidate(
    manager: EntityManager,
    id: string,
    userId: string,
    reason: string,
  ) {
    const confirmation = await manager
      .getRepository(AccountMatchingConfirmationEntity)
      .findOneBy({ id, invalidatedAt: IsNull() });
    if (!confirmation)
      throw new NotFoundException("Confirmación vigente no encontrada.");
    if (!reason.trim())
      throw new BadRequestException("Indica el motivo de invalidación.");
    confirmation.invalidatedAt = new Date();
    confirmation.invalidatedByUserId = userId;
    confirmation.invalidationReason = reason.trim();
    return manager.save(confirmation);
  }
}

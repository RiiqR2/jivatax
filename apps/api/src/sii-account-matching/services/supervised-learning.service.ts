import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { ConfirmationSource } from "../entities/account-matching-confirmation.entity";
import { AccountMatchingConfirmationService } from "./account-matching-confirmation.service";

/** Compatibility facade: confirmations are now immutable evidence, not direct counter updates. */
@Injectable()
export class SupervisedLearningService {
  constructor(
    private readonly confirmations: AccountMatchingConfirmationService,
  ) {}
  async recordConfirmation(
    manager: EntityManager,
    input: {
      companyId: string;
      internalName: string;
      siiAccountId: string;
      userId: string;
    },
  ): Promise<void> {
    await this.confirmations.record(manager, {
      companyId: input.companyId,
      originalName: input.internalName,
      siiAccountId: input.siiAccountId,
      userId: input.userId,
      source: ConfirmationSource.USER,
    });
  }
}

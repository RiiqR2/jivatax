import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountKnowledgeEntity } from "../entities/sii-account-knowledge.entity";

/** TypeORM-only administration boundary; it never creates catalogue accounts. */
@Injectable()
export class AccountKnowledgeService {
  constructor(
    @InjectRepository(SiiAccountEntity)
    private readonly accounts: Repository<SiiAccountEntity>,
    @InjectRepository(SiiAccountKnowledgeEntity)
    private readonly knowledge: Repository<SiiAccountKnowledgeEntity>,
  ) {}

  async saveForExistingAccount(
    siiAccountId: string,
    values: Omit<
      Partial<SiiAccountKnowledgeEntity>,
      "id" | "siiAccountId" | "siiAccount"
    >,
  ) {
    await this.accounts.findOneByOrFail({ id: siiAccountId });
    const existing = await this.knowledge.findOne({
      where: { siiAccountId },
      withDeleted: true,
    });
    const record = this.knowledge.create({
      ...existing,
      ...values,
      siiAccountId,
    });
    if (record.deletedAt) record.deletedAt = null;
    return this.knowledge.save(record);
  }
}

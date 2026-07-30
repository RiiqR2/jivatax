import { Injectable } from "@nestjs/common";
import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import { accountingMetadata } from "../metadata/accounting-metadata";
import type { GeneratedCandidate } from "../account-matching.types";

/** Retrieval only: every active catalogue account enters the ranking pool. */
@Injectable()
export class AccountCandidateGeneratorService {
  generate(
    accounts: SiiAccountEntity[],
    terms: SiiAccountTermEntity[],
  ): GeneratedCandidate[] {
    const byAccount = new Map<string, SiiAccountTermEntity[]>();
    for (const term of terms) {
      if (!term.active || term.deletedAt || term.type === "negative_term")
        continue;
      byAccount.set(term.siiAccountId, [
        ...(byAccount.get(term.siiAccountId) ?? []),
        term,
      ]);
    }
    return accounts
      .filter((account) => !account.deletedAt)
      .map((account) => ({
        account,
        metadata: accountingMetadata(account.name),
        terms: byAccount.get(account.id) ?? [],
      }));
  }
}

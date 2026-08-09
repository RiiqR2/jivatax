import type { Repository } from "typeorm";
import { TaxDocumentEntity } from "../entities/tax-document.entity";
import {
  BalanceRole,
  TaxDocumentStatus,
  TaxDocumentType,
} from "../enums/accounting.enums";

/**
 * Balance import statuses that were processed successfully at some point and
 * therefore hold usable rows: the current one (`processed`) or an older version
 * already replaced by a newer processed import (`superseded`). Failed or
 * in-flight imports (`processing_error`, `invalid`, `uploaded`, `validating`,
 * `processing`) never hold a usable closing Balance for homologation.
 */
export const USABLE_BALANCE_STATUSES: readonly TaxDocumentStatus[] = [
  TaxDocumentStatus.PROCESSED,
  TaxDocumentStatus.SUPERSEDED,
];

/** A processed, non-discarded closing Balance usable for homologation. */
export function isUsableClosingBalance(document: TaxDocumentEntity): boolean {
  return (
    document.documentType === TaxDocumentType.BALANCE &&
    document.balanceRole === BalanceRole.CLOSING &&
    document.discardedAt == null &&
    USABLE_BALANCE_STATUSES.includes(document.status)
  );
}

/**
 * Single source of truth for the closing Balance selection criterion. From a
 * set of tax documents it returns the highest-version CLOSING balance that was
 * processed correctly and is not discarded, or `null` when none qualifies.
 *
 * Because failed/in-flight imports are excluded, a newer failed import never
 * shadows the last good closing, and an opening balance is never selected
 * regardless of its (per-role) version number.
 */
export function selectCurrentClosingBalance(
  documents: TaxDocumentEntity[],
): TaxDocumentEntity | null {
  return (
    documents
      .filter(isUsableClosingBalance)
      .sort((left, right) => right.versionNumber - left.versionNumber)[0] ??
    null
  );
}

/**
 * Resolves the current, valid closing Balance for a company/period reusing
 * {@link selectCurrentClosingBalance} as the only criterion definition. The
 * repository read is intentionally narrow (all balances of the period) so the
 * selection logic stays testable without a database.
 */
export async function findCurrentClosingBalance(
  repository: Repository<TaxDocumentEntity>,
  companyId: string,
  taxPeriodId: string,
  relations?: { storedFile?: boolean },
): Promise<TaxDocumentEntity | null> {
  const documents = await repository.find({
    where: { companyId, taxPeriodId, documentType: TaxDocumentType.BALANCE },
    relations,
  });
  return selectCurrentClosingBalance(documents);
}

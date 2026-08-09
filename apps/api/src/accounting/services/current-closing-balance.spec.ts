import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Repository } from "typeorm";
import { TaxDocumentEntity } from "../entities/tax-document.entity";
import {
  BalanceRole,
  TaxDocumentStatus,
  TaxDocumentType,
} from "../enums/accounting.enums";
import {
  findCurrentClosingBalance,
  selectCurrentClosingBalance,
} from "./current-closing-balance";

const doc = (
  id: string,
  versionNumber: number,
  balanceRole: BalanceRole,
  status: TaxDocumentStatus,
  discarded = false,
) =>
  ({
    id,
    documentType: TaxDocumentType.BALANCE,
    balanceRole,
    status,
    versionNumber,
    discardedAt: discarded ? new Date() : null,
  }) as TaxDocumentEntity;

describe("selectCurrentClosingBalance", () => {
  it("uses the most recent processed closing balance", () => {
    const selected = selectCurrentClosingBalance([
      doc("c1", 1, BalanceRole.CLOSING, TaxDocumentStatus.SUPERSEDED),
      doc("c2", 2, BalanceRole.CLOSING, TaxDocumentStatus.PROCESSED),
    ]);
    assert.equal(selected?.id, "c2");
  });

  it("falls back to the previous processed closing when the newest failed", () => {
    const selected = selectCurrentClosingBalance([
      doc("c3", 3, BalanceRole.CLOSING, TaxDocumentStatus.PROCESSING_ERROR),
      doc("c2", 2, BalanceRole.CLOSING, TaxDocumentStatus.PROCESSED),
      doc("c1", 1, BalanceRole.CLOSING, TaxDocumentStatus.SUPERSEDED),
    ]);
    assert.equal(selected?.id, "c2");
  });

  it("never selects an opening balance even with a higher version", () => {
    const selected = selectCurrentClosingBalance([
      doc("o5", 5, BalanceRole.OPENING, TaxDocumentStatus.PROCESSED),
      doc("c4", 4, BalanceRole.CLOSING, TaxDocumentStatus.PROCESSED),
    ]);
    assert.equal(selected?.id, "c4");
  });

  it("never selects a discarded closing, falling back to the last valid one", () => {
    const selected = selectCurrentClosingBalance([
      doc("c5", 5, BalanceRole.CLOSING, TaxDocumentStatus.DISCARDED, true),
      doc("c4", 4, BalanceRole.CLOSING, TaxDocumentStatus.PROCESSED),
    ]);
    assert.equal(selected?.id, "c4");
  });

  it("accepts a superseded closing when no processed version remains", () => {
    const selected = selectCurrentClosingBalance([
      doc("c2", 2, BalanceRole.CLOSING, TaxDocumentStatus.DISCARDED, true),
      doc("c1", 1, BalanceRole.CLOSING, TaxDocumentStatus.SUPERSEDED),
    ]);
    assert.equal(selected?.id, "c1");
  });

  it("returns null when there is no valid closing balance", () => {
    assert.equal(
      selectCurrentClosingBalance([
        doc("o1", 1, BalanceRole.OPENING, TaxDocumentStatus.PROCESSED),
        doc("c1", 3, BalanceRole.CLOSING, TaxDocumentStatus.PROCESSING_ERROR),
        doc("c0", 2, BalanceRole.CLOSING, TaxDocumentStatus.DISCARDED, true),
      ]),
      null,
    );
    assert.equal(selectCurrentClosingBalance([]), null);
  });
});

describe("findCurrentClosingBalance", () => {
  it("queries the period balances and applies the closing selection criterion", async () => {
    const queries: unknown[] = [];
    const repository = {
      find: async (options: unknown) => {
        queries.push(options);
        return [
          doc("c3", 3, BalanceRole.CLOSING, TaxDocumentStatus.PROCESSING_ERROR),
          doc("c2", 2, BalanceRole.CLOSING, TaxDocumentStatus.PROCESSED),
          doc("o4", 4, BalanceRole.OPENING, TaxDocumentStatus.PROCESSED),
        ];
      },
    } as unknown as Repository<TaxDocumentEntity>;

    const selected = await findCurrentClosingBalance(
      repository,
      "company-1",
      "period-1",
      { storedFile: true },
    );

    assert.equal(selected?.id, "c2");
    assert.deepEqual(queries[0], {
      where: {
        companyId: "company-1",
        taxPeriodId: "period-1",
        documentType: TaxDocumentType.BALANCE,
      },
      relations: { storedFile: true },
    });
  });
});

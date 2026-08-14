import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CompanyAccountMappingStatus } from "../company-account-plan/enums/company-account-plan.enums";
import { SiiAccountPlanVersionStatus } from "../sii-account-plan/enums/sii-account-plan-version-status.enum";
import { A17V1Calculator } from "./calculators/a17-v1.calculator";
import { TaxWorkPapersService } from "./tax-work-papers.service";

describe("detectApplicable query contract", () => {
  it("scopes to company/period, requires confirmed mappings, and never writes", async () => {
    const joins: string[] = [];
    const params: Record<string, unknown>[] = [];
    let saved = false;
    const qb: Record<string, unknown> = {};
    const chain = () => qb;
    qb.innerJoin = (...args: unknown[]) => {
      joins.push(String(args[0]));
      if (args[3] && typeof args[3] === "object")
        params.push(args[3] as Record<string, unknown>);
      return qb;
    };
    qb.leftJoin = (...args: unknown[]) => {
      joins.push(`left:${String(args[0])}`);
      return qb;
    };
    qb.select = chain;
    qb.andWhere = chain;
    qb.orderBy = chain;
    qb.addOrderBy = chain;
    qb.getRawMany = async () => [];
    qb.save = async () => {
      saved = true;
    };
    qb.update = async () => {
      saved = true;
    };
    qb.insert = async () => {
      saved = true;
    };

    const service = new TaxWorkPapersService(
      {} as never,
      {} as never,
      {
        findOneBy: async (where: { id: string; companyId: string }) => {
          assert.equal(where.companyId, "company-a");
          assert.equal(where.id, "period-a");
          return { id: "period-a", companyId: "company-a" };
        },
      } as never,
      { createQueryBuilder: () => qb } as never,
      new A17V1Calculator(),
    );

    const result = await service.detectApplicable("company-a", "period-a");
    assert.deepEqual(result, []);
    assert.equal(saved, false);
    assert.ok(
      params.some(
        (item) => item.confirmed === CompanyAccountMappingStatus.CONFIRMED,
      ),
    );
    assert.ok(
      params.some(
        (item) => item.catalogActive === SiiAccountPlanVersionStatus.ACTIVE,
      ),
    );
    assert.ok(params.some((item) => item.companyId === "company-a"));
    assert.ok(params.some((item) => item.taxPeriodId === "period-a"));
    assert.ok(joins.some((item) => item.includes("company_account_mappings")));
    assert.ok(
      joins.some((item) => item.includes("tax_period_company_accounts")),
    );
  });

  it("rejects a period that does not belong to the company", async () => {
    const service = new TaxWorkPapersService(
      {} as never,
      {} as never,
      { findOneBy: async () => null } as never,
      {
        createQueryBuilder: () => {
          throw new Error("must not query after failed period lookup");
        },
      } as never,
      new A17V1Calculator(),
    );
    await assert.rejects(
      () => service.detectApplicable("company-a", "period-other"),
      /Período tributario no encontrado/,
    );
  });
});

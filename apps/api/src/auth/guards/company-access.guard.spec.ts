import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Repository } from "typeorm";
import { CompanyEntity } from "../../companies/entities/company.entity";
import { OrganizationMemberEntity } from "../../organizations/entities/organization-member.entity";
import { CompanyAccessGuard } from "./company-access.guard";

function context(userId: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        params: {
          companyId: "company-id",
        },
        user: {
          id: userId,
          platformRole: "user",
        },
      }),
    }),
  } as ExecutionContext;
}

describe("CompanyAccessGuard", () => {
  it("rechaza un companyId cuando el usuario no tiene membresía", async () => {
    const companies = {
      findOneBy: async () => ({
        id: "company-id",
        organizationId: "organization-id",
      }),
    } as unknown as Repository<CompanyEntity>;
    const members = {
      existsBy: async () => false,
    } as unknown as Repository<OrganizationMemberEntity>;
    const guard = new CompanyAccessGuard(companies, members);

    await assert.rejects(
      () => guard.canActivate(context("unauthorized-user")),
      ForbiddenException,
    );
  });
});

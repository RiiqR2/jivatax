/// <reference path="../auth/express.d.ts" />

import assert from "node:assert/strict";
import { test } from "node:test";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Test } from "@nestjs/testing";
import { MODULE_METADATA } from "@nestjs/common/constants";
import type { DynamicModule, Provider } from "@nestjs/common";
import { CompanyAccessGuard } from "../auth/guards/company-access.guard";
import { CompanyWriteAccessGuard } from "../auth/guards/company-write-access.guard";
import { CompanyEntity } from "../companies/entities/company.entity";
import { OrganizationMemberEntity } from "../organizations/entities/organization-member.entity";
import { TaxWorkPapersModule } from "./tax-work-papers.module";

test("bootstrap resolves both company guards with the repositories registered by TaxWorkPapersModule", async () => {
  const imports = Reflect.getMetadata(
    MODULE_METADATA.IMPORTS,
    TaxWorkPapersModule,
  ) as DynamicModule[];
  const repositoryProviders = imports.flatMap((item) => item.providers ?? []);
  const providerTokens = repositoryProviders.map((provider: Provider) =>
    typeof provider === "object" && "provide" in provider
      ? provider.provide
      : provider,
  );
  assert.ok(providerTokens.includes(getRepositoryToken(CompanyEntity)));
  assert.ok(
    providerTokens.includes(getRepositoryToken(OrganizationMemberEntity)),
  );

  const repository = {};
  const module = await Test.createTestingModule({
    providers: [
      CompanyAccessGuard,
      CompanyWriteAccessGuard,
      { provide: getRepositoryToken(CompanyEntity), useValue: repository },
      {
        provide: getRepositoryToken(OrganizationMemberEntity),
        useValue: repository,
      },
    ],
  }).compile();

  assert.ok(module.get(CompanyAccessGuard));
  assert.ok(module.get(CompanyWriteAccessGuard));
  await module.close();
});

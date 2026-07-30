import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Repository } from "typeorm";
import { SiiAccountTermEntity } from "../../sii-account-matching/entities/sii-account-term.entity";
import { PeriodAccountMappingsService } from "./period-account-mappings.service";

const source = readFileSync(
  join(__dirname, "period-account-mappings.service.ts"),
  "utf8",
);

test("list usa QueryBuilder y conserva filtros, búsqueda, summary y sugerencia principal", () => {
  assert.doesNotMatch(source, /dataSource\.query|manager\.query/);
  assert.match(source, /periodAccount\.sourceDocumentId = :documentId/);
  assert.match(source, /mapping\.status = :mappingStatus/);
  assert.match(
    source,
    /account\.firstSeenTaxPeriodId = periodAccount\.taxPeriodId/,
  );
  assert.match(source, /account\.name <> periodAccount\.accountNameSnapshot/);
  assert.match(source, /account\.internalCode LIKE :search/);
  assert.match(source, /suggestion\.suggestionRank = :primaryRank/);
  assert.match(source, /primaryRank: 1/);
  assert.match(source, /suggestedCount/);
  assert.match(source, /highConfidence/);
  assert.doesNotMatch(source, /suggestionRank: [23]/);
  assert.match(source, /query\.status === "suggested"/);
  assert.match(source, /suggestion\.id IS NOT NULL/);
  assert.match(source, /query\.status === "withoutSuggestion"/);
  assert.match(source, /suggestion\.id IS NULL/);
  assert.match(source, /mapping\.status = :pendingMappingStatus/);
  assert.match(source, /CompanyAccountMappingStatus\.CONFIRMED[\s\S]*CompanyAccountMappingStatus\.PENDING/);
});

test("update usa repositorios transaccionales, relaciones e historial", () => {
  assert.match(source, /manager\.getRepository\(CompanyAccountMappingEntity\)/);
  assert.match(source, /companyAccount: \{ companyId \}/);
  assert.match(source, /historyRepository\.create/);
  assert.match(source, /historyRepository\.save/);
  assert.match(source, /CompanyAccountSuggestionStatus\.ACCEPTED/);
  assert.match(source, /CompanyAccountSuggestionStatus\.REJECTED/);
  assert.match(
    source,
    /BadRequestException\("La cuenta SII seleccionada no existe\."\)/,
  );
});

test("aprobación masiva valida período, estado y sugerencia principal y reutiliza el dominio", () => {
  assert.match(source, /async approveBatch/);
  assert.match(source, /TaxPeriodCompanyAccountEntity/);
  assert.match(source, /mapping_not_pending/);
  assert.match(source, /active_primary_suggestion_not_found/);
  assert.match(source, /applyMappingDecision/);
  assert.match(source, /CompanyAccountSuggestionStatus\.SUPERSEDED/);
});

test("history carga relaciones y presenta solamente el contrato público", () => {
  assert.match(source, /previousSiiAccount: true/);
  assert.match(source, /newSiiAccount: true/);
  assert.match(source, /changedByUser: true/);
  assert.doesNotMatch(source, /\.\.\.history/);
});

test("alias de empresa no se duplica ni reactiva si ya existe", async () => {
  let saves = 0;
  const existing = { id: "term", active: false } as SiiAccountTermEntity;
  const repository = {
    findOne: async () => existing,
    create: (value: Partial<SiiAccountTermEntity>) => value,
    save: async () => {
      saves++;
    },
  } as unknown as Repository<SiiAccountTermEntity>;
  type AliasCreator = {
    createCompanyAlias(
      repository: Repository<SiiAccountTermEntity>,
      account: { name: string; companyId: string },
      siiAccountId: string,
    ): Promise<void>;
  };
  const service = Object.create(
    PeriodAccountMappingsService.prototype,
  ) as AliasCreator;
  await service.createCompanyAlias(
    repository,
    { name: "BANCO SANTANDER", companyId: "company" },
    "sii",
  );
  assert.equal(saves, 0);
  assert.equal(existing.active, false);
});

test("alias de empresa se crea normalizado cuando no existe", async () => {
  let saved: Partial<SiiAccountTermEntity> | undefined;
  const repository = {
    findOne: async () => null,
    create: (value: Partial<SiiAccountTermEntity>) => value,
    save: async (value: Partial<SiiAccountTermEntity>) => {
      saved = value;
      return value;
    },
  } as unknown as Repository<SiiAccountTermEntity>;
  type AliasCreator = {
    createCompanyAlias(
      repository: Repository<SiiAccountTermEntity>,
      account: { name: string; companyId: string },
      siiAccountId: string,
    ): Promise<void>;
  };
  const service = Object.create(
    PeriodAccountMappingsService.prototype,
  ) as AliasCreator;
  await service.createCompanyAlias(
    repository,
    { name: "BÁNCO  SANTANDER", companyId: "company" },
    "sii",
  );
  assert.equal(saved?.normalizedTerm, "banco santander");
  assert.equal(saved?.scope, "company");
  assert.equal(saved?.active, true);
});

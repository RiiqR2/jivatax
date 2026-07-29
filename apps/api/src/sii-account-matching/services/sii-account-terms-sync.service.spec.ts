import assert from "node:assert/strict";
import test from "node:test";
import { DataSource, Repository } from "typeorm";
import { CompanyAccountMappingEntity } from "../../company-account-plan/entities/company-account-mapping.entity";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import { SiiAccountTermsSyncService } from "./sii-account-terms-sync.service";

const accounts = [
  { id: "account-1", code: "1101", name: "Disponible" },
  { id: "account-2", code: "1102", name: "IVA Créditos" },
] as SiiAccountEntity[];

function fixture(initial: Partial<SiiAccountTermEntity>[] = []) {
  const terms = initial.map((term) => ({ ...term })) as SiiAccountTermEntity[];
  let mappingRepositoryRequested = false;
  const accountRepository = {
    createQueryBuilder: () => ({
      innerJoin() {
        return this;
      },
      where() {
        return this;
      },
      getMany: async () => accounts,
    }),
  } as unknown as Repository<SiiAccountEntity>;
  const termRepository = {
    findOne: async ({ where }: { where: Record<string, unknown> }) =>
      terms.find(
        (term) =>
          term.siiAccountId === where.siiAccountId &&
          term.normalizedTerm === where.normalizedTerm &&
          term.type === where.type &&
          term.source === where.source &&
          term.scope === where.scope &&
          term.companyId == null,
      ) ?? null,
    create: (term: SiiAccountTermEntity) => term,
    save: async (term: SiiAccountTermEntity) => {
      terms.push(term);
      return term;
    },
  } as unknown as Repository<SiiAccountTermEntity>;
  const dataSource = {
    getRepository: (entity: unknown) => {
      if (entity === SiiAccountEntity) return accountRepository;
      if (entity === SiiAccountTermEntity) return termRepository;
      if (entity === CompanyAccountMappingEntity)
        mappingRepositoryRequested = true;
      throw new Error("Unexpected repository");
    },
  } as DataSource;
  return {
    service: new SiiAccountTermsSyncService(dataSource),
    terms,
    mappingRepositoryRequested: () => mappingRepositoryRequested,
  };
}

const knowledge = [
  {
    siiAccountCode: "1101",
    terms: [
      { term: "Caja", type: "alias" as const, weight: 60 },
      {
        term: "Préstamo bancario",
        type: "negative_term" as const,
        weight: -40,
      },
    ],
  },
];

test("crea nombres oficiales y conocimiento curado sin crear cuentas ni mappings", async () => {
  const state = fixture();
  const result = await state.service.synchronize(knowledge);
  assert.deepEqual(
    {
      accounts: result.siiAccountsRead,
      official: result.officialTermsCreated,
      aliases: result.aliasesCreated,
      negative: result.negativeTermsCreated,
    },
    { accounts: 2, official: 2, aliases: 1, negative: 1 },
  );
  assert.equal(state.terms.length, 4);
  assert.equal(state.mappingRepositoryRequested(), false);
  assert.equal(accounts.length, 2);
});

test("es idempotente y no duplica términos en una segunda ejecución", async () => {
  const state = fixture();
  await state.service.synchronize(knowledge);
  const second = await state.service.synchronize(knowledge);
  assert.equal(state.terms.length, 4);
  assert.equal(second.existingTermsSkipped, 4);
  assert.equal(second.officialTermsCreated, 0);
});

test("normaliza tildes y puntuación antes de buscar y guardar", async () => {
  const state = fixture();
  await state.service.synchronize([
    {
      siiAccountCode: "1102",
      terms: [{ term: "  IVA, CRÉDITOS!! ", type: "alias", weight: 55 }],
    },
  ]);
  assert.equal(
    state.terms.find((term) => term.type === "alias")?.normalizedTerm,
    "iva creditos",
  );
});

test("omite existentes, conserva pesos y no reactiva inactivos", async () => {
  const state = fixture([
    {
      siiAccountId: "account-1",
      companyId: null,
      scope: "global",
      normalizedTerm: "disponible",
      type: "official_name",
      source: "sii_catalog",
      weight: 99,
      active: true,
    },
    {
      siiAccountId: "account-1",
      companyId: null,
      scope: "global",
      normalizedTerm: "caja",
      type: "alias",
      source: "jivatax_curated",
      weight: 10,
      active: false,
    },
  ]);
  const result = await state.service.synchronize(knowledge);
  assert.equal(result.existingTermsSkipped, 1);
  assert.equal(result.inactiveTermsSkipped, 1);
  assert.equal(state.terms[0].weight, 99);
  assert.equal(state.terms[1].weight, 10);
  assert.equal(state.terms[1].active, false);
});

test("informa códigos curados que no existen en el catálogo activo", async () => {
  const state = fixture();
  const result = await state.service.synchronize([
    { siiAccountCode: "INEXISTENTE", terms: [] },
  ]);
  assert.deepEqual(result.missingReferencedAccounts, ["INEXISTENTE"]);
  assert.equal(state.terms.length, 2);
});

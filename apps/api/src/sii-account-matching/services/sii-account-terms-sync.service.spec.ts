import assert from "node:assert/strict";
import test from "node:test";
import { Repository } from "typeorm";
import { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { SiiAccountPlanVersionEntity } from "../../sii-account-plan/entities/sii-account-plan-version.entity";
import { SiiAccountPlanVersionStatus } from "../../sii-account-plan/enums/sii-account-plan-version-status.enum";
import { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import { SiiAccountTermsSyncService } from "./sii-account-terms-sync.service";
import { SII_ACCOUNT_ALIASES } from "../data/sii-account-aliases";
import { AccountCandidateGeneratorService } from "./account-candidate-generator.service";

const accounts = [
  { id: "account-1", versionId: "version-1", code: "1101", name: "Disponible" },
  {
    id: "account-2",
    versionId: "version-1",
    code: "1102",
    name: "IVA Créditos",
  },
] as SiiAccountEntity[];

const version = {
  id: "version-1",
  code: "catalog-2026",
  name: "Catálogo 2026",
  status: SiiAccountPlanVersionStatus.DRAFT,
  importedAt: new Date("2026-01-01"),
} as SiiAccountPlanVersionEntity;

function fixture(
  initial: Partial<SiiAccountTermEntity>[] = [],
  availableAccounts = accounts,
  versions: SiiAccountPlanVersionEntity[] = [version],
) {
  const terms = initial.map((term) => ({ ...term })) as SiiAccountTermEntity[];
  const accountRepository = {
    count: async () => availableAccounts.length,
    find: async ({ where }: { where: { versionId: string } }) =>
      availableAccounts.filter(
        (account) => account.versionId === where.versionId,
      ),
  } as unknown as Repository<SiiAccountEntity>;
  const versionRepository = {
    find: async () => versions,
  } as unknown as Repository<SiiAccountPlanVersionEntity>;
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
  return {
    service: new SiiAccountTermsSyncService(
      accountRepository,
      versionRepository,
      termRepository,
    ),
    terms,
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
      totalAccounts: result.totalSiiAccountsInDatabase,
      versions: result.versionsFound,
      selectedVersion: result.selectedVersionId,
      official: result.officialTermsCreated,
      aliases: result.aliasesCreated,
      negative: result.negativeTermsCreated,
    },
    {
      accounts: 2,
      totalAccounts: 2,
      versions: 1,
      selectedVersion: "version-1",
      official: 2,
      aliases: 1,
      negative: 1,
    },
  );
  assert.equal(state.terms.length, 4);
  assert.equal(accounts.length, 2);
});

test("prefiere la versión active real sobre la versión importada más reciente", async () => {
  const activeVersion = {
    ...version,
    id: "version-1",
    status: SiiAccountPlanVersionStatus.ACTIVE,
  } as SiiAccountPlanVersionEntity;
  const newerDraft = {
    ...version,
    id: "version-2",
    status: SiiAccountPlanVersionStatus.DRAFT,
    importedAt: new Date("2026-02-01"),
  } as SiiAccountPlanVersionEntity;
  const state = fixture([], accounts, [newerDraft, activeVersion]);
  const result = await state.service.synchronize([]);
  assert.equal(result.selectedVersionId, "version-1");
  assert.equal(result.siiAccountsRead, 2);
});

test("falla si hay cuentas pero la versión seleccionada no contiene ninguna", async () => {
  const state = fixture([], accounts, [{ ...version, id: "other" }]);
  await assert.rejects(
    state.service.synchronize([]),
    /no contiene cuentas, pero sii_accounts contiene 2 registros/,
  );
  assert.equal(state.terms.length, 0);
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

test("persiste aliases de gastos en 3.01.03.00 y es idempotente", async () => {
  const expense = {
    id: "expense-account",
    versionId: "version-1",
    code: "3.01.03.00",
    name: "Gastos de administración y ventas (menos)",
  } as SiiAccountEntity;
  const state = fixture([], [expense]);

  const first = await state.service.synchronize();
  assert.equal(first.aliasesCreated, 16);
  const persisted = state.terms.filter(
    (term) => term.source === "jivatax_curated",
  );
  assert.equal(persisted.length, 16);
  assert.ok(
    [
      "arriendo",
      "gastos de honorarios",
      "honorarios",
      "electricidad",
      "luz",
      "servicios basicos",
    ].every((normalized) =>
      persisted.some(
        (term) =>
          term.siiAccountId === expense.id &&
          term.normalizedTerm === normalized &&
          term.active,
      ),
    ),
  );
  assert.ok(
    persisted.every(
      (term) => Number(term.weight) >= 56 && Number(term.weight) <= 65,
    ),
  );

  const candidates = new AccountCandidateGeneratorService().generate(
    [expense],
    state.terms,
  );
  for (const normalized of ["arriendo", "gastos de honorarios", "electricidad"])
    assert.ok(
      candidates[0].terms.some((term) => term.normalizedTerm === normalized),
    );

  const second = await state.service.synchronize();
  assert.equal(second.aliasesCreated, 0);
  assert.equal(second.existingTermsSkipped, 17);
  assert.equal(state.terms.length, 17);
});

test("la fuente curada asocia gastos solo a 3.01.03.00", () => {
  const expenseKnowledge = SII_ACCOUNT_ALIASES.find(
    (entry) => entry.siiAccountCode === "3.01.03.00",
  );
  assert.ok(expenseKnowledge);
  const prepaidKnowledge = SII_ACCOUNT_ALIASES.find(
    (entry) => entry.siiAccountCode === "1.01.11.00",
  );
  const protectedTerms = new Set([
    "arriendo",
    "gastos de honorarios",
    "honorarios",
    "electricidad",
    "luz",
    "servicios basicos",
  ]);
  assert.ok(
    [...protectedTerms].every((term) =>
      expenseKnowledge.terms.some((candidate) => candidate.term === term),
    ),
  );
  assert.equal(
    prepaidKnowledge?.terms.some((candidate) =>
      protectedTerms.has(candidate.term),
    ) ?? false,
    false,
  );
});

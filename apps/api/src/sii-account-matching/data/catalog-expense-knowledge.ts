import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import type { SiiAccountConceptEntity } from "../entities/sii-account-concept.entity";
import type { SiiAccountTermEntity } from "../entities/sii-account-term.entity";
import { accountingMetadata } from "../metadata/accounting-metadata";
import { normalizeAccountConcept } from "../normalization/account-concept-normalizer";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";

type ExpenseKnowledgeRule = {
  destinationPatterns: readonly RegExp[];
  terms: ReadonlyArray<{
    term: string;
    type: "alias" | "erp_term" | "industry_term";
    weight: number;
  }>;
  concepts: readonly string[];
};

const OPERATIONAL_FALLBACK =
  /gastos? (de )?(administracion|administrativos|operacionales|de ventas)|otros gastos? de administracion/;

const RULES: readonly ExpenseKnowledgeRule[] = [
  {
    destinationPatterns: [
      /arriend|arrendamiento|alquiler/,
      OPERATIONAL_FALLBACK,
    ],
    terms: [
      { term: "arriendo", type: "alias", weight: 60 },
      { term: "gasto de arriendo", type: "erp_term", weight: 58 },
      { term: "alquiler", type: "alias", weight: 60 },
      { term: "arrendamiento", type: "industry_term", weight: 58 },
      { term: "renta de local", type: "industry_term", weight: 56 },
    ],
    concepts: [
      "gasto operacional",
      "ocupación de inmueble",
      "resultado del período",
      "saldo deudor",
    ],
  },
  {
    destinationPatterns: [
      /honorario|servicios profesionales|asesorias/,
      OPERATIONAL_FALLBACK,
    ],
    terms: [
      { term: "honorarios", type: "alias", weight: 60 },
      { term: "gastos de honorarios", type: "erp_term", weight: 60 },
      { term: "honorarios profesionales", type: "industry_term", weight: 58 },
      { term: "servicios profesionales", type: "industry_term", weight: 58 },
      { term: "asesorías profesionales", type: "industry_term", weight: 56 },
    ],
    concepts: [
      "gasto administrativo",
      "servicios profesionales",
      "resultado del período",
      "saldo deudor",
    ],
  },
  {
    destinationPatterns: [
      /electricidad|energia electrica|servicios basicos/,
      OPERATIONAL_FALLBACK,
    ],
    terms: [
      { term: "electricidad", type: "alias", weight: 60 },
      { term: "energía eléctrica", type: "industry_term", weight: 58 },
      { term: "consumo eléctrico", type: "erp_term", weight: 58 },
      { term: "gasto de electricidad", type: "erp_term", weight: 60 },
      { term: "luz", type: "alias", weight: 55 },
      { term: "servicios básicos", type: "industry_term", weight: 58 },
    ],
    concepts: [
      "gasto operacional",
      "servicios básicos",
      "resultado del período",
      "saldo deudor",
    ],
  },
];

/**
 * Resolves curated knowledge against the accounts actually loaded from the
 * selected SII version. No catalogue code or UUID is assumed: a rule is only
 * materialized after finding a non-aggregate, expense-classified destination.
 */
export function resolveCatalogExpenseKnowledge(accounts: SiiAccountEntity[]) {
  const activeExpenses = accounts.filter((account) => {
    const name = normalizeAccountTerm(account.name);
    return (
      !account.deletedAt &&
      accountingMetadata(account.name).statementSection === "expense" &&
      !/(^|\s)(total|subtotal|suma)(es)?(\s|$)/.test(name)
    );
  });
  const terms = new Map<string, SiiAccountTermEntity[]>();
  const concepts = new Map<string, SiiAccountConceptEntity[]>();
  const destinations: Array<{ code: string; name: string; family: string }> =
    [];

  for (const rule of RULES) {
    const destination = rule.destinationPatterns
      .map((pattern) =>
        activeExpenses.find((account) =>
          pattern.test(normalizeAccountTerm(account.name)),
        ),
      )
      .find(Boolean);
    if (!destination) continue;
    const metadata = accountingMetadata(destination.name);
    destinations.push({
      code: destination.code,
      name: destination.name,
      family: metadata.family,
    });
    terms.set(destination.id, [
      ...(terms.get(destination.id) ?? []),
      ...rule.terms.map(
        (item) =>
          ({
            siiAccountId: destination.id,
            term: item.term,
            normalizedTerm: normalizeAccountTerm(item.term),
            type: item.type,
            weight: item.weight,
            active: true,
            deletedAt: null,
          }) as SiiAccountTermEntity,
      ),
    ]);
    concepts.set(destination.id, [
      ...(concepts.get(destination.id) ?? []),
      ...rule.concepts.map(
        (concept) =>
          ({
            siiAccountId: destination.id,
            concept,
            normalizedConcept: normalizeAccountConcept(concept),
            conceptType:
              concept === "saldo deudor"
                ? "balance_nature"
                : "economic_concept",
            weight: 70,
            active: true,
            deletedAt: null,
          }) as SiiAccountConceptEntity,
      ),
    ]);
  }
  return { terms, concepts, destinations };
}

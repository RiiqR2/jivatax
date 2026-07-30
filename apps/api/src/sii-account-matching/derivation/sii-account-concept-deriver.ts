import type { SiiAccountEntity } from "../../sii-account-plan/entities/sii-account.entity";
import { normalizeAccountConcept } from "../normalization/account-concept-normalizer";
import {
  SII_ACCOUNT_CONCEPT_RULES,
  type DerivedConceptDefinition,
} from "./sii-account-concept-rules";

export function deriveConceptsFromSiiAccount(
  account: Pick<SiiAccountEntity, "name">,
): DerivedConceptDefinition[] {
  const normalizedName = normalizeAccountConcept(account.name);
  const derived = SII_ACCOUNT_CONCEPT_RULES.filter((rule) =>
    rule.matches(normalizedName),
  ).flatMap((rule) => rule.concepts);
  const unique = new Map<string, DerivedConceptDefinition>();
  for (const item of derived) {
    const identity = `${item.type}:${normalizeAccountConcept(item.concept)}`;
    const current = unique.get(identity);
    if (!current || item.weight > current.weight) unique.set(identity, item);
  }
  return [...unique.values()];
}

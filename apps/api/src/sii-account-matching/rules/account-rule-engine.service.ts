import { Injectable } from "@nestjs/common";
import type {
  AccountingMetadata,
  GeneratedCandidate,
  MatchingSignal,
  ObservedAccountSection,
} from "../account-matching.types";
import type {
  AccountMatchingRuleEntity,
  RuleCondition,
} from "../entities/account-matching-rule.entity";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";

export type RuleEvaluation = {
  excluded: boolean;
  review: boolean;
  signals: MatchingSignal[];
  evaluatedRuleIds: string[];
};

const builtInRules: ReadonlyArray<
  Pick<
    AccountMatchingRuleEntity,
    | "ruleKey"
    | "name"
    | "priority"
    | "condition"
    | "action"
    | "explanation"
    | "active"
  >
> = [
  {
    ruleKey: "sales_never_expense",
    name: "Ventas no son gastos",
    priority: 1000,
    condition: {
      sourcePattern: "(^|\\s)ventas?(\\s|$)",
      candidateSection: "expense",
    },
    action: { type: "exclude" },
    explanation: "Una venta no puede homologarse como gasto.",
    active: true,
  },
  {
    ruleKey: "cost_never_income",
    name: "Costos no son ingresos",
    priority: 1000,
    condition: { sourcePattern: "^costo", candidateSection: "income" },
    action: { type: "exclude" },
    explanation: "Un costo no puede homologarse como ingreso.",
    active: true,
  },
  {
    ruleKey: "capital_is_equity",
    name: "Capital es patrimonio",
    priority: 950,
    condition: {
      sourcePattern: "(^|\\s)capital(\\s|$)",
      candidateSection: "equity",
    },
    action: { type: "score", points: 50 },
    explanation: "El capital pertenece al patrimonio.",
    active: true,
  },
  {
    ruleKey: "ppm_is_asset",
    name: "PPM recuperable",
    priority: 900,
    condition: {
      sourcePattern: "(^|\\s)ppm(\\s|$)",
      candidateTaxType: "ppm",
      candidateSection: "asset",
    },
    action: { type: "score", points: 45 },
    explanation: "Los PPM normalmente representan un activo tributario.",
    active: true,
  },
  {
    ruleKey: "withholding_is_liability",
    name: "Retenciones son pasivos",
    priority: 900,
    condition: {
      sourcePattern: "retencion|impuesto unico|imposiciones",
      candidateTaxType: "withholding",
      candidateSection: "liability",
    },
    action: { type: "score", points: 45 },
    explanation: "Las retenciones de terceros son obligaciones.",
    active: true,
  },
  {
    ruleKey: "partner_current_account_review",
    name: "Cuenta corriente de socio requiere revisión",
    priority: 850,
    condition: {
      sourcePattern: "cuenta corriente socio|cuenta cte socio|cta cte socio",
    },
    action: { type: "review" },
    explanation:
      "La naturaleza de una cuenta corriente de socio depende de su saldo y sustancia.",
    active: true,
  },
];

@Injectable()
export class AccountRuleEngineService {
  evaluate(
    sourceName: string,
    source: AccountingMetadata,
    observed: ObservedAccountSection,
    candidate: GeneratedCandidate,
    configuredRules: AccountMatchingRuleEntity[] = [],
  ): RuleEvaluation {
    const normalized = normalizeAccountTerm(sourceName);
    const rules = [
      ...builtInRules,
      ...configuredRules.filter((rule) => rule.active),
    ].sort(
      (a, b) => b.priority - a.priority || a.ruleKey.localeCompare(b.ruleKey),
    );
    const signals: MatchingSignal[] = [];
    const evaluatedRuleIds: string[] = [];
    let excluded = false;
    let review = false;
    for (const rule of rules) {
      evaluatedRuleIds.push(rule.ruleKey);
      if (
        !this.matches(rule.condition, normalized, source, observed, candidate)
      )
        continue;
      if (rule.action.type === "exclude") excluded = true;
      if (rule.action.type === "review") review = true;
      signals.push({
        signal: `rule:${rule.ruleKey}`,
        description: rule.explanation,
        points: rule.action.type === "score" ? (rule.action.points ?? 0) : 0,
        kind: "rule",
        source: "rule",
        ruleId: rule.ruleKey,
      });
    }
    return { excluded, review, signals, evaluatedRuleIds };
  }

  private matches(
    condition: RuleCondition,
    normalized: string,
    source: AccountingMetadata,
    observed: ObservedAccountSection,
    candidate: GeneratedCandidate,
  ): boolean {
    const knowledge = candidate.knowledge;
    if (
      condition.sourcePattern &&
      !new RegExp(condition.sourcePattern, "i").test(normalized)
    )
      return false;
    if (condition.sourceFamily && condition.sourceFamily !== source.family)
      return false;
    if (condition.observedSection && condition.observedSection !== observed)
      return false;
    if (
      condition.candidateFamily &&
      condition.candidateFamily !==
        (knowledge?.accountingFamily ?? candidate.metadata.family)
    )
      return false;
    if (
      condition.candidateSection &&
      condition.candidateSection !==
        (knowledge?.statementSection ?? candidate.metadata.statementSection)
    )
      return false;
    if (
      condition.candidateTaxType &&
      condition.candidateTaxType !== knowledge?.taxType
    )
      return false;
    if (
      condition.candidateFinancialType &&
      condition.candidateFinancialType !== knowledge?.financialType
    )
      return false;
    return true;
  }
}

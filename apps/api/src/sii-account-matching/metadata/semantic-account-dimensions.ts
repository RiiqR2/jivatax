import type {
  AccountTerm,
  BalanceContext,
  GeneratedCandidate,
  ObservedAccountSection,
} from "../account-matching.types";
import { normalizeAccountTerm } from "../normalization/account-term-normalizer";
import { accountingMetadata } from "./accounting-metadata";

export type SemanticAccountDimension =
  | "current_vs_noncurrent"
  | "prepaid_assets"
  | "allowance_accounts"
  | "temporary_or_bridge_accounts"
  | "financial_assets"
  | "lease_accounts"
  | "related_party_accounts"
  | "accrued_liabilities"
  | "investment_accounts"
  | "rental_expenses";

export type InferredSemanticProfile = {
  dimensions: Set<SemanticAccountDimension>;
  temporalTerm?: AccountTerm;
  isBadDebtAllowance: boolean;
  isPayablesProvision: boolean;
  isRelatedPartyReceivable: boolean;
  isBridgePayment: boolean;
  isEquityRetained: boolean;
  isRentalExpense: boolean;
};

export const EXTENDED_GENERIC_MATCH_TOKENS = new Set([
  "credito",
  "transito",
  "resultado",
  "fondo",
  "pago",
  "ingreso",
  "egreso",
  "donacion",
  "donaciones",
  "cargo",
  "abono",
  "interes",
  "intereses",
  "provision",
  "provisiones",
  "corriente",
]);

const NON_CURRENT_PATTERN =
  /\b(no corriente|no-corriente|largo plazo|lp\b|\bnc\b)\b/i;
const CURRENT_TERM_PATTERN =
  /\b(corto plazo|corriente)\b/i;
const CUENTA_CORRIENTE_PATTERN = /cuenta corriente/i;

export function inferTemporalTerm(name: string): AccountTerm | undefined {
  const normalized = normalizeAccountTerm(name);
  if (NON_CURRENT_PATTERN.test(normalized)) return "non_current";
  if (CUENTA_CORRIENTE_PATTERN.test(normalized)) return undefined;
  if (CURRENT_TERM_PATTERN.test(normalized)) return "current";
  return accountingMetadata(name).term;
}

export function inferSemanticProfile(
  name: string,
  _context?: {
    observedSection?: ObservedAccountSection;
    balanceContext?: BalanceContext;
  },
): InferredSemanticProfile {
  const normalized = normalizeAccountTerm(name);
  const dimensions = new Set<SemanticAccountDimension>();
  const temporalTerm = inferTemporalTerm(name);
  if (temporalTerm) dimensions.add("current_vs_noncurrent");

  const isBadDebtAllowance =
    /provision deuda incobrable|provision incobrable|deuda incobrable|deudores incobrables|castigo de deudores|estimacion deudores incobrables|provision clientes incobrables/.test(
      normalized,
    );
  const isPayablesProvision =
    /provision gastos por pagar|provisiones por pagar|provision obligaciones|provision cuentas por pagar/.test(
      normalized,
    );
  if (isBadDebtAllowance || /provision complementaria|deterioro acumulado/.test(normalized)) {
    dimensions.add("allowance_accounts");
  }

  if (
    /seguros anticipados|comisiones anticipadas|gastos pagados por anticipado|gasto pagado por anticipado|seguro anticipado|comision anticipada|anticipos? de seguro|anticipos? de comision/.test(
      normalized,
    )
  ) {
    dimensions.add("prepaid_assets");
  }

  if (/pagos en transito|pagos en tránsito|valores en transito|valores en tránsito/.test(normalized)) {
    dimensions.add("temporary_or_bridge_accounts");
  }

  if (
    /prestamo por cobrar|préstamo por cobrar|creditos por cobrar|créditos por cobrar|instrumentos financieros|deposito a plazo|depósito a plazo/.test(
      normalized,
    )
  ) {
    dimensions.add("financial_assets");
  }

  if (/leasing|arrendamiento financiero|intereses diferidos leasing|activo por derecho de uso/.test(normalized)) {
    dimensions.add("lease_accounts");
  }

  const isRelatedPartyReceivable =
    /relacionad|relacionada|empresa relacionada|parte relacionada/.test(normalized) &&
    /prestamo|préstamo|cobrar|deudor|credito|crédito/.test(normalized);
  if (isRelatedPartyReceivable || /empresa relacionada|parte relacionada/.test(normalized)) {
    dimensions.add("related_party_accounts");
  }

  if (/intereses por pagar|honorarios por pagar|remuneraciones por pagar|vacaciones por pagar|provision imposiciones|provision vacaciones/.test(normalized)) {
    dimensions.add("accrued_liabilities");
  }

  if (/inversion|inversión|instrumentos financieros|sociedades|acciones en otras empresas|pagos basados en acciones/.test(normalized)) {
    dimensions.add("investment_accounts");
  }

  const isRentalExpense =
    /^arriendo\b|arriendo fijo|gasto de arriendo|gastos de arriendo|arrendamiento operacional|canon de arrendamiento/.test(
      normalized,
    ) &&
    !/anticipad|prepag|pagado por adelantado/.test(normalized);
  if (isRentalExpense) dimensions.add("rental_expenses");

  const isEquityRetained =
    /resultado acumulado|utilidades acumuladas|perdidas acumuladas|pérdidas acumuladas|resultados acumulados/.test(
      normalized,
    );

  return {
    dimensions,
    temporalTerm,
    isBadDebtAllowance,
    isPayablesProvision,
    isRelatedPartyReceivable,
    isBridgePayment: dimensions.has("temporary_or_bridge_accounts"),
    isEquityRetained,
    isRentalExpense,
  };
}

export function candidateSemanticProfile(
  candidate: GeneratedCandidate,
): InferredSemanticProfile {
  return inferSemanticProfile(candidate.account.name, {
    observedSection: candidate.metadata.statementSection as ObservedAccountSection,
  });
}

export function temporalTermsCompatible(
  observed?: AccountTerm,
  candidate?: AccountTerm,
): boolean {
  if (!observed || !candidate) return true;
  return observed === candidate;
}

export function semanticProfilesCompatible(
  observed: InferredSemanticProfile,
  candidate: GeneratedCandidate,
  observedName: string,
): { compatible: boolean; reason?: string } {
  const candidateNormalized = normalizeAccountTerm(candidate.account.name);

  if (
    !temporalTermsCompatible(observed.temporalTerm, candidate.metadata.term)
  ) {
    return { compatible: false, reason: "incompatible_temporal_term" };
  }
  if (observed.temporalTerm === "non_current") {
    if (
      /\b(corriente|corto plazo)\b/.test(candidateNormalized) &&
      !NON_CURRENT_PATTERN.test(candidateNormalized)
    )
      return { compatible: false, reason: "non_current_vs_current_destination" };
  }
  if (observed.temporalTerm === "current") {
    if (NON_CURRENT_PATTERN.test(candidateNormalized))
      return { compatible: false, reason: "current_vs_non_current_destination" };
  }

  if (observed.isBadDebtAllowance) {
    if (observed.isPayablesProvision)
      return { compatible: false, reason: "bad_debt_vs_payables_provision" };
    if (
      /provision gastos por pagar|gastos por pagar|cuentas por pagar/.test(
        candidateNormalized,
      )
    )
      return { compatible: false, reason: "bad_debt_vs_payables_provision" };
    if (
      !candidate.metadata.contraAccount &&
      !/incobrable|deudor/.test(candidateNormalized)
    )
      return {
        compatible: false,
        reason: "bad_debt_requires_receivable_allowance",
      };
  }

  if (observed.isBridgePayment) {
    if (/existencias en transito|existencias en tránsito|inventario en transito/.test(candidateNormalized))
      return { compatible: false, reason: "bridge_payment_vs_inventory_transit" };
    if (/pagos basados en acciones|acciones otorgadas|stock options/.test(candidateNormalized))
      return { compatible: false, reason: "bridge_payment_vs_equity_compensation" };
    if (!/pagos en transito|pagos en tránsito|valores en transito|disponible|banco/.test(candidateNormalized))
      return { compatible: false, reason: "bridge_payment_requires_cash_bridge" };
  }

  if (observed.isRelatedPartyReceivable) {
    if (observed.temporalTerm === "non_current" && candidate.metadata.term === "current")
      return { compatible: false, reason: "related_party_nc_vs_current" };
    if (
      !/relacionad|prestamo|préstamo|cobrar|deudor|credito|crédito/.test(
        candidateNormalized,
      ) &&
      candidate.metadata.family === "cash"
    )
      return { compatible: false, reason: "related_party_vs_generic_cash" };
  }

  if (
    /intereses prestamo|intereses préstamo|intereses por cobrar/.test(
      normalizeAccountTerm(observedName),
    ) &&
    observed.temporalTerm === "non_current"
  ) {
    if (/intereses diferidos leasing|leasing|arrendamiento financiero/.test(candidateNormalized))
      return { compatible: false, reason: "loan_interest_vs_lease_deferred" };
  }

  if (observed.isEquityRetained) {
    if (
      !/utilidad|utilidades|perdida|pérdida|patrimonio|capital|resultado acumulado|equity/.test(
        candidateNormalized,
      ) &&
      candidate.metadata.statementSection !== "equity"
    )
      return { compatible: false, reason: "retained_earnings_requires_equity" };
  }

  if (observed.isRentalExpense) {
    if (
      candidate.metadata.statementSection !== "expense" &&
      !/arriendo|arrendamiento|administracion|administración/.test(
        candidateNormalized,
      )
    )
      return { compatible: false, reason: "rental_requires_expense_family" };
  }

  if (observed.dimensions.has("prepaid_assets")) {
    if (
      candidate.metadata.family !== "prepaid_expenses" &&
      !/anticipad|diferido|prepag|pagado por adelantado/.test(candidateNormalized)
    )
      return { compatible: false, reason: "prepaid_asset_required" };
  }

  return { compatible: true };
}

export function candidateSupportedOnlyByGenericTokens(
  observedName: string,
  candidate: GeneratedCandidate,
  reasons: Array<{ signal: string; points: number }>,
): boolean {
  const hasStrongEvidence = reasons.some(
    (reason) =>
      reason.points > 0 &&
      (reason.signal.startsWith("exact_") ||
        reason.signal === "historical_company_mapping" ||
        reason.signal.startsWith("supervised_learning") ||
        reason.signal === "exact_concept"),
  );
  if (hasStrongEvidence) return false;

  const normalizedObserved = normalizeAccountTerm(observedName);
  const normalizedCandidate = normalizeAccountTerm(candidate.account.name);
  const observedTokens = [...normalizedObserved.split(/\s+/).filter(Boolean)];
  const candidateTokens = new Set(
    normalizedCandidate.split(/\s+/).filter(Boolean),
  );
  const shared = observedTokens.filter((token) => candidateTokens.has(token));
  return (
    shared.length > 0 &&
    shared.every((token) => EXTENDED_GENERIC_MATCH_TOKENS.has(token))
  );
}

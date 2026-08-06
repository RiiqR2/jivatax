import type { ObservedAccountSection } from "../account-matching.types";
import type { GeneratedCandidate } from "../account-matching.types";
import type { BalanceContext } from "../account-matching.types";
import {
  normalizeAccountTerm,
  relevantWords,
} from "../normalization/account-term-normalizer";
import { accountingMetadata } from "./accounting-metadata";

export type BasicAccountFamily =
  | "cash_and_bank"
  | "receivables"
  | "inventory"
  | "prepaid"
  | "fixed_assets"
  | "payables"
  | "taxes"
  | "payroll"
  | "equity"
  | "revenue"
  | "cost"
  | "expense"
  | "financial_investment"
  | "deferred"
  | "other";

export const GENERIC_MATCH_TOKENS = new Set([
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
]);

const OPERATIONAL_BANK_SUFFIX =
  /\s+(ingresos|egresos|cargos|abonos|movimientos)\s*$/i;

const BANK_INSTITUTION =
  /^(banco\b|banco de\b|cuenta corriente banco|cta cte banco|cta\.?\s*cte\.?\s*banco)/i;

const COMPATIBLE_CANDIDATE_FAMILIES: Record<
  BasicAccountFamily,
  ReadonlySet<BasicAccountFamily> | null
> = {
  cash_and_bank: new Set(["cash_and_bank"]),
  receivables: new Set(["receivables"]),
  inventory: new Set(["inventory"]),
  prepaid: new Set(["prepaid", "payables"]),
  fixed_assets: new Set(["fixed_assets"]),
  payables: new Set(["payables", "prepaid", "payroll"]),
  taxes: new Set(["taxes"]),
  payroll: new Set(["payroll", "payables"]),
  equity: new Set(["equity"]),
  revenue: new Set(["revenue"]),
  cost: new Set(["cost", "expense"]),
  expense: new Set(["expense", "cost", "deferred"]),
  financial_investment: new Set(["financial_investment", "cash_and_bank"]),
  deferred: new Set(["deferred", "expense", "prepaid"]),
  other: null,
};

export function isBankInstitutionName(name: string): boolean {
  const normalized = normalizeAccountTerm(name).replace(
    OPERATIONAL_BANK_SUFFIX,
    "",
  );
  return BANK_INSTITUTION.test(normalized);
}

export function stripOperationalBankSuffix(name: string): string {
  return normalizeAccountTerm(name).replace(OPERATIONAL_BANK_SUFFIX, "").trim();
}

export function inferBasicAccountFamily(
  name: string,
  context?: {
    observedSection?: ObservedAccountSection;
    balanceContext?: BalanceContext;
  },
): BasicAccountFamily {
  const normalized = normalizeAccountTerm(name);
  const bankBase = stripOperationalBankSuffix(name);
  const assetObserved =
    context?.observedSection === "asset" ||
    Number(context?.balanceContext?.assetAmount) > 0;

  if (
    /^bancos?\b/.test(normalized) &&
    (context?.observedSection === "liability" ||
      Number(context?.balanceContext?.liabilityAmount) > 0) &&
    !assetObserved
  )
    return "payables";

  if (isBankInstitutionName(name) || /^cuenta corriente\b/.test(bankBase)) {
    return assetObserved || context?.observedSection === "unknown"
      ? "cash_and_bank"
      : "cash_and_bank";
  }

  if (
    /^caja\b|caja chica|efectivo|disponible|bancos?\b|pagos en transito|pagos en tránsito|valores en transito|valores en tránsito/.test(
      normalized,
    )
  )
    return "cash_and_bank";

  if (/^iva credito fiscal|iva crédito fiscal/.test(normalized)) return "taxes";

  if (
    /anticipo a proveedores|anticipos? a proveedores|anticipo proveedores/.test(
      normalized,
    )
  )
    return "prepaid";

  if (
    /honorarios diferidos|gastos diferidos|costos diferidos|gasto diferido/.test(
      normalized,
    )
  )
    return "deferred";

  if (
    /existencias en transito|existencias en tránsito|mercaderias en transito|mercaderías en tránsito/.test(
      normalized,
    )
  )
    return "inventory";

  if (
    /^clientes\b|deudores|cuentas por cobrar|documentos por cobrar/.test(
      normalized,
    )
  )
    return "receivables";

  if (
    /^proveedores\b|cuentas por pagar|documentos por pagar|obligaciones por pagar/.test(
      normalized,
    )
  )
    return "payables";

  if (
    /remuneraciones|sueldos|salarios|honorarios por pagar|gratificaciones/.test(
      normalized,
    )
  )
    return "payroll";

  if (
    /^capital\b|patrimonio|utilidad|resultado acumulado|perdidas acumuladas|pérdidas acumuladas/.test(
      normalized,
    )
  )
    return "equity";

  if (
    /^ventas\b|ingresos por ventas|ingresos de explotacion|ingresos de explotación/.test(
      normalized,
    )
  )
    return "revenue";

  if (
    /^costo de ventas|costos de explotacion|costos de explotación|costo de servicios/.test(
      normalized,
    )
  )
    return "cost";

  if (
    /^gastos?\b|gasto de |gastos de |arriendo|electricidad|servicios basicos|servicios básicos/.test(
      normalized,
    )
  )
    return "expense";

  if (/anticipad|prepag|prepago|pagado por adelantado/.test(normalized))
    return "prepaid";

  if (
    /maquinaria|equipos|vehiculos|vehículos|inmuebles|activo fijo|depreciacion|depreciación/.test(
      normalized,
    )
  )
    return "fixed_assets";

  if (/inventario|existencias|mercaderias|mercaderías|stock/.test(normalized))
    return "inventory";

  if (
    /inversion|inversión|instrumentos financieros|deposito a plazo|depósito a plazo/.test(
      normalized,
    )
  )
    return "financial_investment";

  if (
    /^iva\b|impuesto|ppm|retencion|retención|credito fiscal|crédito fiscal/.test(
      normalized,
    )
  )
    return "taxes";

  const legacy = accountingMetadata(name).family;
  return (
    (
      {
        cash: "cash_and_bank",
        receivables: "receivables",
        inventory: "inventory",
        prepaid_expenses: "prepaid",
        fixed_assets: "fixed_assets",
        payables: "payables",
        taxes: "taxes",
        equity: "equity",
        income: "revenue",
        expenses: "expense",
        financial_liabilities: "payables",
        depreciation: "fixed_assets",
      } as Record<string, BasicAccountFamily>
    )[legacy] ?? "other"
  );
}

export function candidateBasicAccountFamily(
  candidate: GeneratedCandidate,
): BasicAccountFamily {
  const normalized = normalizeAccountTerm(candidate.account.name);
  const code = candidate.account.code;

  if (code === "1.01.01.00" || /disponible|caja|banco/.test(normalized))
    return "cash_and_bank";
  if (
    code === "1.01.59.00" ||
    /^iva credito fiscal|iva crédito fiscal/.test(normalized)
  )
    return "taxes";
  if (/anticipo a proveedores|anticipos a proveedores/.test(normalized))
    return "prepaid";
  if (/existencias en transito|existencias en tránsito/.test(normalized))
    return "inventory";
  if (
    /pagos en transito|pagos en tránsito|valores en transito|valores en tránsito/.test(
      normalized,
    )
  )
    return "cash_and_bank";
  if (/creditos por donaciones|créditos por donaciones/.test(normalized))
    return "financial_investment";
  if (/gastos diferidos|costos diferidos/.test(normalized)) return "deferred";
  if (/honorarios diferidos/.test(normalized)) return "deferred";

  return inferBasicAccountFamily(candidate.account.name);
}

export function basicFamiliesCompatible(
  observed: BasicAccountFamily,
  candidate: BasicAccountFamily,
): boolean {
  if (observed === "other" || candidate === "other") return true;
  const allowed = COMPATIBLE_CANDIDATE_FAMILIES[observed];
  return allowed ? allowed.has(candidate) : true;
}

export function matchingTokens(name: string): Set<string> {
  const normalized = isBankInstitutionName(name)
    ? stripOperationalBankSuffix(name)
    : normalizeAccountTerm(name);
  const tokens = relevantWords(normalized);
  if (isBankInstitutionName(name)) {
    for (const token of [...tokens]) {
      if (
        token === "credito" ||
        token === "inversiones" ||
        token === "inversion"
      )
        tokens.delete(token);
    }
  }
  return tokens;
}

export function isGenericOnlyTokenOverlap(
  sourceName: string,
  targetName: string,
): boolean {
  const left = matchingTokens(sourceName);
  const right = matchingTokens(targetName);
  const intersection = [...left].filter((token) => right.has(token));
  return (
    intersection.length > 0 &&
    intersection.every((token) => GENERIC_MATCH_TOKENS.has(token))
  );
}

import type { ObservedAccountSection } from "../account-matching.types";

/**
 * The imported catalogue follows the official "Balance Tributario 8 Columnas"
 * numbering: chapter 1 is Activos, chapter 2 is Pasivos y Patrimonio (2.03 is
 * its equity sub-chapter) and chapter 3 is Resultado (it mixes income and
 * expense lines, so the chapter alone cannot disambiguate it). This is a
 * structural property of the stable SII code, not curated content, so it can
 * override a lexical guess made from the account's own name (e.g. an asset
 * named "Gastos Diferidos" must not be classified as an expense).
 */
export function catalogChapterSection(
  code: string,
): ObservedAccountSection | undefined {
  if (code.startsWith("1.")) return "asset";
  if (code.startsWith("2.03")) return "equity";
  if (code.startsWith("2.")) return "liability";
  return undefined;
}

/**
 * Chapter 3 is the income statement (Resultado). It mixes income and expense
 * lines, so the chapter alone cannot pick a section, but it is never a
 * Balance sheet destination: a P&L name that happens to mention "activo fijo"
 * must not be classified as an asset just from that embedded phrase.
 */
export function isResultChapter(code: string): boolean {
  return code.startsWith("3.");
}

/**
 * Chapter 5 is the RLI tax-reconciliation schedule (additions/deductions to
 * taxable income, e.g. "Otros agregados al resultado tributario por
 * inventarios"). It is not a Balance or income-statement destination: it
 * represents roughly 60% of the catalogue and lexical overlap alone must
 * never resolve an ordinary account into it. Only an explicit exact name,
 * curated term or accounting rule may target this chapter.
 */
export function isTaxReconciliationChapter(code: string): boolean {
  return code.startsWith("5.");
}

/**
 * Balance-sheet catch-all / residual catalogue lines ("Otros activos
 * corrientes", "Otros pasivos NO Corrientes"...). Income-statement lines that
 * legitimately start with "Otros ingresos/gastos" are NOT residual: those are
 * real destinations. Without curated knowledge the official name itself is
 * enough to keep these Balance catch-alls out of ranked overlap.
 */
export function isResidualCatalogName(name: string): boolean {
  return /^(?:otros|otras)\s+(?:activos?|pasivos?)\b/.test(
    name.trim().toLocaleLowerCase("es-CL"),
  );
}

/**
 * Off-balance / memo order accounts are not ordinary Balance destinations.
 */
export function isOrderCatalogName(name: string): boolean {
  return /cuentas? de orden/.test(name.trim().toLocaleLowerCase("es-CL"));
}

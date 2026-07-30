const ABBREVIATIONS: ReadonlyArray<[RegExp, string]> = [
  [/\bdep(?:rec)?\b/g, "depreciacion"],
  [/\bacum\b/g, "acumulada"],
  [/\bmaq\b/g, "maquinarias"],
  [/\beq(?:uip)?\b/g, "equipos"],
  [/\bcta\b/g, "cuenta"],
  [/\bctte\b/g, "corriente"],
  [/\bcred\b/g, "credito"],
  [/\bcf\b/g, "credito fiscal"],
  [/\bdf\b/g, "debito fiscal"],
  [/\blp\b/g, "largo plazo"],
  [/\bcp\b/g, "corto plazo"],
  [/\bprov\b/g, "proveedores"],
  [/\brem\b/g, "remuneraciones"],
];

/** Canonical, deterministic representation used by both sync and scoring. */
export function normalizeAccountTerm(value: string): string {
  let normalized = value
    .toLocaleLowerCase("es-CL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  for (const [pattern, replacement] of ABBREVIATIONS)
    normalized = normalized.replace(pattern, replacement);
  return normalized.replace(/\s+/g, " ").trim();
}

export function relevantWords(value: string): Set<string> {
  const ignored = new Set([
    "de",
    "del",
    "la",
    "las",
    "los",
    "y",
    "en",
    "por",
    "cuenta",
    "cuentas",
    "otros",
    "otras",
    "varias",
  ]);
  return new Set(
    normalizeAccountTerm(value)
      .split(" ")
      .filter((word) => word.length > 2 && !ignored.has(word)),
  );
}

const LOW_WEIGHT_WORDS = new Set([
  "impuesto",
  "impuestos",
  "gasto",
  "gastos",
  "activo",
  "activos",
  "pasivo",
  "pasivos",
  "general",
  "generales",
]);

/** Accounting tokens stay present; generic ones contribute less, never zero. */
export function accountTokenWeight(word: string): number {
  return LOW_WEIGHT_WORDS.has(word) ? 0.35 : 1;
}

export function weightedTokenSimilarity(left: string, right: string): number {
  const leftWords = relevantWords(left);
  const rightWords = relevantWords(right);
  const union = new Set([...leftWords, ...rightWords]);
  if (!union.size) return 0;
  let shared = 0;
  let total = 0;
  for (const word of union) {
    const weight = accountTokenWeight(word);
    total += weight;
    if (leftWords.has(word) && rightWords.has(word)) shared += weight;
  }
  return shared / total;
}

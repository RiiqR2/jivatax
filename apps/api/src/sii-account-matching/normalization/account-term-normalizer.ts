const ABBREVIATIONS: ReadonlyArray<[RegExp, string]> = [
  [/\bdep(?:rec)?\b/g, "depreciacion"],
  [/\bacum\b/g, "acumulada"],
  [/\bmaq\b/g, "maquinaria"],
  [/\beq(?:uip)?\b/g, "equipos"],
  [/\bcta\b/g, "cuenta"],
  [/\bctte\b/g, "corriente"],
  [/\bcred\b/g, "credito"],
  [/\bcf\b/g, "credito fiscal"],
  [/\bdf\b/g, "debito fiscal"],
  [/\blp\b/g, "largo plazo"],
  [/\bcp\b/g, "corto plazo"],
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
    "general",
    "impuesto",
    "gasto",
    "activo",
    "pasivo",
  ]);
  return new Set(
    normalizeAccountTerm(value)
      .split(" ")
      .filter((word) => word.length > 2 && !ignored.has(word)),
  );
}

export type DecimalValueState =
  "absent" | "invalid" | "zero" | "positive" | "negative";

/** Classifies a DECIMAL string lexically, without converting it to a JS number. */
export function decimalValueState(value?: string | null): DecimalValueState {
  if (value == null || value.trim() === "") return "absent";
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return "invalid";
  const nonZero = `${match[2]}${match[3] ?? ""}`.replace(/0/g, "").length > 0;
  if (!nonZero) return "zero";
  return match[1] === "-" ? "negative" : "positive";
}

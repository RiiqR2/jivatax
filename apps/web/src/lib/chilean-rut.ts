export function normalizeChileanRut(value: string): string {
  return value.trim().replace(/\./g, "").replace(/\s/g, "").toUpperCase();
}
export function isValidChileanRut(value: string): boolean {
  const normalized = normalizeChileanRut(value);
  if (!/^\d{7,8}-[0-9K]$/.test(normalized)) return false;
  const [body, verifier] = normalized.split("-");
  let sum = 0;
  let multiplier = 2;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const result = 11 - (sum % 11);
  return (
    verifier === (result === 11 ? "0" : result === 10 ? "K" : String(result))
  );
}

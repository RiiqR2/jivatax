/** Conservative normalization: concepts retain every accounting word. */
export function normalizeAccountConcept(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .replace(/[()[\]{}.,;:!?/\\_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

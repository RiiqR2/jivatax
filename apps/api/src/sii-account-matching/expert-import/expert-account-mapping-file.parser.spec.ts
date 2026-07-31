import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { ExpertAccountMappingFileParser } from "./expert-account-mapping-file.parser";

async function fixture(
  rows: unknown[][],
  sheet = "Homologaciones",
): Promise<string> {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), sheet);
  const file = join(
    await mkdtemp(join(tmpdir(), "expert-mappings-")),
    "input.xlsx",
  );
  await writeFile(
    file,
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer,
  );
  return file;
}
describe("ExpertAccountMappingFileParser", () => {
  it("acepta aliases y conserva códigos mostrados como texto", async () => {
    const file = await fixture([
      ["Descripción", "Código interno", "Cuenta SII"],
      ["Caja", "001-2", "01.02"],
    ]);
    const parsed = await new ExpertAccountMappingFileParser().parse(file);
    assert.deepEqual(parsed.rows[0], {
      rowNumber: 2,
      internalAccountCode: "001-2",
      originalName: "Caja",
      siiCode: "01.02",
    });
  });
  it("rechaza encabezados incompletos, hojas inexistentes y libros vacíos", async () => {
    const incomplete = await fixture([["Descripción"], ["Caja"]]);
    await assert.rejects(
      () => new ExpertAccountMappingFileParser().parse(incomplete),
      /Faltan encabezados/,
    );
    await assert.rejects(
      () => new ExpertAccountMappingFileParser().parse(incomplete, "Otra"),
      /no existe/,
    );
    const empty = await fixture([]);
    await assert.rejects(
      () => new ExpertAccountMappingFileParser().parse(empty),
      /vacía/,
    );
  });
});

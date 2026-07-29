import { Injectable } from "@nestjs/common";
import * as XLSX from "xlsx";
import { DOCUMENT_CONTRACTS } from "../contracts/document-contracts";
import { TaxDocumentType } from "../enums/accounting.enums";

@Injectable()
export class DocumentTemplateService {
  create(type: TaxDocumentType): Buffer {
    const contract = DOCUMENT_CONTRACTS[type];
    const required = Object.values(contract.required).map((aliases) =>
      this.label(aliases[0]),
    );
    const headers = required.concat(contract.optional);
    const data = XLSX.utils.aoa_to_sheet([
      headers,
      this.example(type, headers.length),
    ]);
    data["!autofilter"] = {
      ref: `A1:${this.columnName(headers.length - 1)}2`,
    };
    data["!freeze"] = { xSplit: 0, ySplit: 1 };
    data["!cols"] = headers.map((header) => ({
      wch: Math.max(14, header.length + 2),
    }));
    const instructions = XLSX.utils.aoa_to_sheet([
      [contract.title],
      ["Objetivo", "Importar la base contable del período seleccionado."],
      ["Columnas requeridas", required.join(", ")],
      ["Columnas opcionales", contract.optional.join(", ")],
      ["Formatos", "XLS, XLSX o CSV. La plantilla oficial es XLSX."],
      [
        "Códigos",
        "Trátelos como texto para preservar ceros iniciales, puntos y guiones.",
      ],
      ["Fechas", "Use fechas válidas comprendidas en el período tributario."],
      ["Montos", "Use números no negativos; no escriba símbolos de moneda."],
      [
        "Errores comunes",
        "No cambie el significado de encabezados ni combine Debe y Haber en una línea.",
      ],
    ]);
    instructions["!cols"] = [{ wch: 24 }, { wch: 90 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, data, "Datos");
    XLSX.utils.book_append_sheet(workbook, instructions, "Instrucciones");
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  private label(alias: string): string {
    return alias.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
  }

  private columnName(index: number): string {
    let value = index + 1;
    let name = "";
    while (value > 0) {
      value -= 1;
      name = String.fromCharCode(65 + (value % 26)) + name;
      value = Math.floor(value / 26);
    }
    return name;
  }

  private example(type: TaxDocumentType, length: number): unknown[] {
    const values =
      type === TaxDocumentType.BALANCE
        ? ["001-01", "Caja", 1000, 1000, 0, 0, 0, 0, 0, 0]
        : type === TaxDocumentType.GENERAL_LEDGER
          ? ["001-01", "Caja", new Date(), "Factura", "1", "Ejemplo", 1000, 0]
          : [new Date(), "1", 1, "001-01", 1000, 0, "Ejemplo"];
    return values.concat(Array(Math.max(0, length - values.length)).fill(""));
  }
}

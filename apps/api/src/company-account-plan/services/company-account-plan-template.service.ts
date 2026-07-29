import { Injectable } from "@nestjs/common";
import * as XLSX from "xlsx";
import { ACCOUNT_PLAN_FILE_CONTRACT } from "../company-account-plan.contract";

@Injectable()
export class CompanyAccountPlanTemplateService {
  generate(): Buffer {
    const workbook = XLSX.utils.book_new();
    const headers = ACCOUNT_PLAN_FILE_CONTRACT.columns.map(
      (column) => column.header,
    );
    const example = ACCOUNT_PLAN_FILE_CONTRACT.example;
    const sheet = XLSX.utils.aoa_to_sheet([
      headers,
      [
        example.code,
        example.name,
        example.description,
        example.level,
        example.parentCode,
        example.status,
      ],
    ]);

    sheet.A2 = {
      t: "s",
      v: example.code,
      z: "@",
    };
    sheet.E2 = {
      t: "s",
      v: example.parentCode,
      z: "@",
    };
    sheet.D2 = {
      t: "n",
      v: example.level,
      z: "0",
    };
    sheet["!autofilter"] = {
      ref: "A1:F2",
    };
    sheet["!freeze"] = {
      xSplit: 0,
      ySplit: 1,
      topLeftCell: "A2",
      activePane: "bottomLeft",
      state: "frozen",
    };
    sheet["!cols"] = [
      {
        wch: 20,
      },
      {
        wch: 30,
      },
      {
        wch: 42,
      },
      {
        wch: 10,
      },
      {
        wch: 20,
      },
      {
        wch: 14,
      },
    ];
    sheet["!dataValidation"] = [
      {
        sqref: "F2:F20001",
        type: "list",
        formula1: '"active,inactive"',
        allowBlank: true,
      },
    ];

    XLSX.utils.book_append_sheet(
      workbook,
      sheet,
      ACCOUNT_PLAN_FILE_CONTRACT.sheetName,
    );
    XLSX.utils.book_append_sheet(
      workbook,
      this.createInstructionsSheet(),
      ACCOUNT_PLAN_FILE_CONTRACT.instructionsSheetName,
    );

    return XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
      cellStyles: true,
    }) as Buffer;
  }

  private createInstructionsSheet(): XLSX.WorkSheet {
    const rows = [
      ["Instrucciones para importar el plan de cuentas"],
      ["Columnas obligatorias", "Código y Nombre."],
      ["Columnas opcionales", "Descripción, Nivel, Código padre y Estado."],
      [
        "Códigos",
        "Mantener como texto para conservar ceros iniciales, puntos y guiones.",
      ],
      ["Estado", "active o inactive. Si se deja vacío se utilizará active."],
      ["Límite", "Máximo 10 MB y 20.000 cuentas."],
      ["Formatos", "XLSX, XLS o CSV."],
      [
        "Contenido",
        "Una cuenta por fila. No incluir totales ni repetir encabezados.",
      ],
      ["Excel", "No usar celdas combinadas ni fórmulas."],
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    sheet["!cols"] = [
      {
        wch: 24,
      },
      {
        wch: 78,
      },
    ];
    return sheet;
  }
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { accountingService } from "@/services/accounting.service";
import type { TaxDocumentType } from "@/types/accounting.types";

const contracts = {
  balance: {
    title: "Balance de ocho columnas",
    description:
      "Fuente primaria del catálogo acumulativo de cuentas de la empresa.",
    required: [
      "Código cuenta",
      "Nombre cuenta",
      "Débitos",
      "Créditos",
      "Saldo deudor",
      "Saldo acreedor",
      "Activo",
      "Pasivo",
      "Pérdidas",
      "Ganancias",
    ],
    optional: [
      "Código padre",
      "Nivel",
      "Centro de costo",
      "Moneda",
      "Observación",
    ],
    template: "Balance",
  },
  general_ledger: {
    title: "Libro Mayor",
    description:
      "Movimientos detallados por cuenta para conciliar con el Balance.",
    required: [
      "Código cuenta",
      "Nombre cuenta",
      "Fecha",
      "Tipo documento",
      "Número documento",
      "Glosa",
      "Debe",
      "Haber",
    ],
    optional: [
      "Saldo deudor",
      "Saldo acreedor",
      "Centro de costo",
      "Código auxiliar",
      "RUT contraparte",
      "Número comprobante",
      "Moneda",
      "Tipo de cambio",
    ],
    template: "Libro Mayor",
  },
  journal: {
    title: "Libro Diario",
    description:
      "Asientos y comprobantes contables, preservando su información tributaria.",
    required: [
      "Fecha",
      "Número comprobante",
      "Secuencia",
      "Código cuenta",
      "Debe",
      "Haber",
      "Glosa",
    ],
    optional: [
      "Nombre cuenta",
      "Tipo documento",
      "Número documento",
      "RUT contraparte",
      "Nombre contraparte",
      "Código auxiliar",
      "Centro de costo",
      "Libro",
      "Moneda",
      "Tipo de cambio",
      "Fecha documento",
      "Fecha vencimiento",
      "Monto neto",
      "Monto exento",
      "IVA",
      "IVA activo fijo",
      "Código impuesto adicional",
      "Tasa impuesto adicional",
      "Monto impuesto adicional",
      "Asiento apertura",
      "Indicador activo fijo",
    ],
    template: "Libro Diario",
  },
};

export function AccountingDocumentsPage({
  companyId,
  taxPeriodId,
}: {
  companyId: string;
  taxPeriodId: string;
}) {
  const [type, setType] = useState<TaxDocumentType>("balance");
  const contract = contracts[type];
  const documents = useQuery({
    queryKey: ["tax-documents", companyId, taxPeriodId],
    queryFn: () => accountingService.documents(companyId, taxPeriodId),
  });
  const history =
    documents.data?.filter((document) => document.documentType === type) ?? [];
  return (
    <main className="mx-auto max-w-7xl p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-emerald-700">
            Período tributario activo
          </p>
          <h1 className="text-3xl font-semibold">Documentos contables</h1>
          <p className="mt-1 text-slate-500">{contract.description}</p>
        </div>
        <a
          href={accountingService.templateUrl(companyId, type)}
          className="inline-flex w-auto shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white"
        >
          <Download className="size-4" />
          Descargar plantilla de {contract.template}
        </a>
      </div>
      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {(Object.keys(contracts) as TaxDocumentType[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${type === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white"}`}
          >
            {contracts[value].title}
          </button>
        ))}
      </div>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold">
          Formato esperado: {contract.title}
        </h2>
        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <ColumnList
            title="Columnas requeridas"
            values={contract.required}
            required
          />
          <ColumnList title="Columnas opcionales" values={contract.optional} />
        </div>
        <p className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
          Use XLS, XLSX o CSV. Conserve códigos como texto, fechas válidas y
          montos sin símbolos. Los negativos se revisan y nunca se corrigen
          silenciosamente.
        </p>
      </section>
      <section className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <FileSpreadsheet className="mx-auto size-10 text-emerald-700" />
        <h2 className="mt-3 font-semibold">Cargar {contract.title}</h2>
        <p className="mt-1 text-sm text-slate-500">
          La carga usa la URL firmada y el almacenamiento directo configurado
          para la empresa.
        </p>
        <input type="file" accept=".xls,.xlsx,.csv" className="mt-5 text-sm" />
      </section>
      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b p-5">
          <h2 className="font-semibold">Historial de {contract.title}</h2>
        </div>
        {documents.isLoading ? (
          <p className="flex items-center gap-2 p-6 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            Cargando historial…
          </p>
        ) : history.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            Aún no existen versiones de este documento.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    "Archivo",
                    "Versión",
                    "Carga",
                    "Estado",
                    "Filas",
                    "Válidas",
                    "Errores",
                    "Warnings",
                  ].map((label) => (
                    <th key={label} className="px-4 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((document) => (
                  <tr key={document.id} className="border-t">
                    <td className="px-4 py-3">
                      {document.storedFile.originalName}
                    </td>
                    <td className="px-4 py-3">v{document.versionNumber}</td>
                    <td className="px-4 py-3">
                      {new Date(document.uploadedAt).toLocaleDateString(
                        "es-CL",
                      )}
                    </td>
                    <td className="px-4 py-3">{document.status}</td>
                    <td className="px-4 py-3">
                      {document.metadata?.rowsRead ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {document.metadata?.validRows ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {document.metadata?.errors?.length ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      {document.metadata?.warnings?.length ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function ColumnList({
  title,
  values,
  required = false,
}: {
  title: string;
  values: string[];
  required?: boolean;
}) {
  return (
    <div>
      <h3 className="font-medium">{title}</h3>
      <ul className="mt-2 divide-y rounded-lg border">
        {values.map((value) => (
          <li key={value} className="flex justify-between px-3 py-2 text-sm">
            <span>{value}</span>
            {required && (
              <span className="text-xs font-medium text-red-600">
                Obligatoria
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

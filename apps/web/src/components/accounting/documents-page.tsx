"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { filesApi } from "../../../lib/files/files-api";
import {
  MAX_ACCOUNTING_FILE_SIZE,
  processAccountingFile,
  type AccountingUploadStage,
  validateAccountingFile,
} from "@/lib/accounting-document-upload";
import { accountingService } from "@/services/accounting.service";
import type {
  TaxDocument,
  TaxDocumentReport,
  TaxDocumentType,
} from "@/types/accounting.types";
import {
  canReviewMappings,
  statusPresentation,
} from "@/lib/accounting-presentation";
import { explorerDocumentPath } from "@/lib/accounting-navigation";

const contracts = {
  balance: {
    title: "Balance de ocho columnas",
    shortName: "Balance",
    description: "Fuente primaria del catálogo acumulativo de cuentas.",
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
    aliases:
      "Código cuenta acepta cuenta, código, cod cuenta o número cuenta. Nombre acepta nombre, glosa o descripción.",
  },
  general_ledger: {
    title: "Libro Mayor",
    shortName: "Libro Mayor",
    description:
      "Movimientos detallados por cuenta para conciliar con Balance.",
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
    aliases:
      "Fecha acepta fecha movimiento o fecha contable; Debe acepta débito o cargo; Haber acepta crédito o abono.",
  },
  journal: {
    title: "Libro Diario",
    shortName: "Libro Diario",
    description: "Asientos y comprobantes con información contable tributaria.",
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
    aliases:
      "Número comprobante acepta comprobante o nro comprobante; Secuencia acepta línea o número línea.",
  },
};

const stageLabels: Record<AccountingUploadStage, string> = {
  idle: "Sin archivo seleccionado",
  selected: "Archivo seleccionado",
  preparing: "Preparando carga",
  uploading: "Subiendo archivo",
  uploaded: "Archivo cargado",
  validating: "Validando",
  processing: "Procesando",
  processed: "Procesado correctamente",
  processed_with_warnings: "Procesado con advertencias",
  validation_error: "Error de validación",
  processing_error: "Error de procesamiento",
};

export function AccountingDocumentsPage({
  companyId,
  taxPeriodId,
}: {
  companyId: string;
  taxPeriodId: string;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<TaxDocumentType>("balance");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [stage, setStage] = useState<AccountingUploadStage>("idle");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [formatOpen, setFormatOpen] = useState(false);
  const [result, setResult] = useState<{
    document: TaxDocument;
    report: TaxDocumentReport;
  } | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const contract = contracts[type];
  const busy = [
    "preparing",
    "uploading",
    "uploaded",
    "validating",
    "processing",
  ].includes(stage);
  const documents = useQuery({
    queryKey: ["tax-documents", companyId, taxPeriodId, type],
    queryFn: () => accountingService.documents(companyId, taxPeriodId, type),
  });
  const history = documents.data ?? [];

  const resetSelection = () => {
    setFile(null);
    setFileError(null);
    setStage("idle");
    setProgress(0);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };
  const chooseType = (value: TaxDocumentType) => {
    setType(value);
    setFormatOpen(false);
    resetSelection();
  };
  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    const error = validateAccountingFile(candidate);
    setFile(candidate);
    setFileError(error);
    setResult(null);
    setProgress(0);
    setStage(error ? "idle" : "selected");
  };
  const process = async () => {
    if (!file || fileError || busy) return;
    setFileError(null);
    try {
      const uploadResult = await processAccountingFile(
        companyId,
        taxPeriodId,
        type,
        file,
        { onStage: setStage, onProgress: setProgress },
        {
          files: filesApi,
          accounting: accountingService,
        },
      );
      setResult(uploadResult);
      await queryClient.invalidateQueries({
        queryKey: ["tax-documents", companyId, taxPeriodId],
      });
    } catch (error) {
      setStage("processing_error");
      setFileError(
        error instanceof Error
          ? error.message
          : "No fue posible procesar el documento.",
      );
      await queryClient.invalidateQueries({
        queryKey: ["tax-documents", companyId, taxPeriodId],
      });
    }
  };
  const downloadTemplate = async () => {
    setTemplateLoading(true);
    setTemplateError(null);
    try {
      const response = await fetch(
        accountingService.templateUrl(companyId, type),
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("No fue posible descargar la plantilla.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `plantilla-${type}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setTemplateError(
        error instanceof Error
          ? error.message
          : "No fue posible descargar la plantilla.",
      );
    } finally {
      setTemplateLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-emerald-700">
            Período tributario activo
          </p>
          <h1 className="text-3xl font-semibold">Documentos contables</h1>
          <p className="mt-1 text-sm text-slate-500">{contract.description}</p>
        </div>
        <button
          type="button"
          onClick={() => void downloadTemplate()}
          disabled={templateLoading}
          className="inline-flex w-auto shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
        >
          {templateLoading ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
          Descargar plantilla de {contract.shortName}
        </button>
      </header>
      {templateError && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {templateError}
        </p>
      )}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist">
        {(Object.keys(contracts) as TaxDocumentType[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={type === value}
            onClick={() => chooseType(value)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${type === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white"}`}
          >
            {contracts[value].title}
          </button>
        ))}
      </div>

      <History
        companyId={companyId}
        taxPeriodId={taxPeriodId}
        type={type}
        documents={history}
        loading={documents.isLoading}
        refresh={() => documents.refetch()}
      />

      <section className="mt-5 rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          aria-expanded={formatOpen}
          aria-controls="document-format-details"
          onClick={() => setFormatOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-4 p-5 text-left focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <span>
            <strong>Formato esperado: {contract.title}</strong>
            <span className="mt-1 block text-sm text-slate-500">
              {contract.required.length} requeridas · {contract.optional.length}{" "}
              opcionales · XLS, XLSX o CSV
            </span>
          </span>
          <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
            {formatOpen ? "Ocultar detalles" : "Ver detalles"}
            <ChevronDown
              className={`size-4 transition ${formatOpen ? "rotate-180" : ""}`}
            />
          </span>
        </button>
        {formatOpen && (
          <div id="document-format-details" className="border-t p-5">
            <div className="grid gap-6 lg:grid-cols-2">
              <ColumnList
                title="Columnas requeridas"
                values={contract.required}
                required
              />
              <ColumnList
                title="Columnas opcionales"
                values={contract.optional}
              />
            </div>
            <div className="mt-5 space-y-3 text-sm text-slate-700">
              <p>
                <strong>Alias aceptados:</strong> {contract.aliases}
              </p>
              <p>
                <strong>Reglas:</strong> preserve códigos como texto, use fechas
                válidas y montos sin símbolos.
              </p>
              <p>
                <strong>Validaciones:</strong> campos obligatorios, montos no
                negativos, fechas del período y conciliación contable.
              </p>
              <p>
                <strong>Errores frecuentes:</strong> encabezados ambiguos,
                códigos convertidos a número, movimientos con Debe y Haber
                simultáneos.
              </p>
            </div>
          </div>
        )}
      </section>

      <label
        htmlFor="accounting-document-file"
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length !== 1) {
            setFileError("Selecciona un único archivo.");
            return;
          }
          acceptFile(event.dataTransfer.files[0]);
        }}
        className={`mt-4 block cursor-pointer rounded-xl border-2 border-dashed bg-white p-5 text-center transition focus-within:ring-2 focus-within:ring-emerald-600 hover:border-emerald-500 hover:bg-emerald-50/30 ${dragging ? "border-emerald-600 bg-emerald-50" : "border-slate-300"}`}
      >
        <input
          ref={inputRef}
          id="accounting-document-file"
          type="file"
          accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            if ((event.target.files?.length ?? 0) > 1) {
              setFileError("Selecciona un único archivo.");
              return;
            }
            acceptFile(event.target.files?.[0]);
          }}
        />
        <FileSpreadsheet className="mx-auto size-8 text-emerald-700" />
        <p className="mt-2 font-semibold">
          Arrastra el archivo aquí o haz clic para seleccionarlo
        </p>
        <p className="mt-1 text-xs text-slate-500">
          XLS, XLSX o CSV · máximo {MAX_ACCOUNTING_FILE_SIZE / 1024 / 1024} MB
        </p>
      </label>
      {fileError && (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-800"
        >
          {fileError}
        </p>
      )}
      {stage !== "idle" && (
        <section
          aria-live="polite"
          role="status"
          className="mt-4 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="flex justify-between gap-4 text-sm">
            <strong>{stageLabels[stage]}</strong>
            <span>{stage === "uploading" ? `${progress}%` : ""}</span>
          </div>
          {stage === "uploading" && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-emerald-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </section>
      )}

      {file && (
        <section className="mt-4 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <FileSpreadsheet className="size-8 shrink-0 text-emerald-700" />
          <div className="min-w-0 flex-1">
            <p title={file.name} className="truncate font-medium">
              {file.name}
            </p>
            <p className="text-xs text-slate-500">
              {file.name.split(".").pop()?.toUpperCase()} ·{" "}
              {(file.size / 1024).toLocaleString("es-CL", {
                maximumFractionDigits: 1,
              })}{" "}
              KB · {contract.title} · período seleccionado
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              Reemplazar
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={resetSelection}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"
            >
              <Trash2 className="size-4" />
              Quitar
            </button>
            <button
              type="button"
              disabled={!file || Boolean(fileError) || busy || !taxPeriodId}
              onClick={() => void process()}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Procesar {contract.shortName}
            </button>
          </div>
        </section>
      )}

      {result && (
        <ProcessingResult
          companyId={companyId}
          taxPeriodId={taxPeriodId}
          type={type}
          result={result}
        />
      )}
    </main>
  );
}

function ProcessingResult({
  companyId,
  taxPeriodId,
  type,
  result,
}: {
  companyId: string;
  taxPeriodId: string;
  type: TaxDocumentType;
  result: { document: TaxDocument; report: TaxDocumentReport };
}) {
  const report = result.report;
  const invalid =
    result.document.status === "invalid" ||
    ((report.errors?.length ?? 0) > 0 && (report.validRows ?? 0) === 0);
  return (
    <section
      className={`mt-4 rounded-xl border p-5 ${invalid ? "border-red-300 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}
      role={invalid ? "alert" : undefined}
    >
      <h2 className="font-semibold">
        {invalid ? "Importación rechazada" : "Resultado de procesamiento"}
      </h2>
      {invalid && (
        <p className="mt-2 text-sm">
          No se importó ninguna fila. El archivo contiene{" "}
          {report.errors?.length ?? 0} errores de validación.
        </p>
      )}
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
        <Metric label="Versión" value={`v${result.document.versionNumber}`} />
        <Metric label="Filas leídas" value={report.rowsRead ?? "—"} />
        <Metric label="Filas válidas" value={report.validRows ?? "—"} />
        <Metric label="Ignoradas" value={report.ignoredRows ?? "—"} />
        <Metric label="Errores" value={report.errors?.length ?? 0} />
        <Metric label="Warnings" value={report.warnings?.length ?? 0} />
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/companies/${companyId}/periods/${taxPeriodId}/documents/${result.document.id}/report`}
          className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium"
        >
          {invalid ? "Ver reporte de errores" : "Ver reporte completo"}
        </Link>
        {canReviewMappings(type, result.document.status, report) && (
          <Link
            href={`/companies/${companyId}/periods/${taxPeriodId}/account-mapping?documentId=${result.document.id}`}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white"
          >
            Revisar homologaciones
          </Link>
        )}
        {explorerDocumentPath(companyId, taxPeriodId, result.document) && (
          <Link
            href={explorerDocumentPath(
              companyId,
              taxPeriodId,
              result.document,
            )!}
            className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-800"
          >
            {type === "balance" ? "Ver Balance" : "Ver en explorador contable"}
          </Link>
        )}
      </div>
    </section>
  );
}

function History({
  companyId,
  taxPeriodId,
  type,
  documents,
  loading,
  refresh,
}: {
  companyId: string;
  taxPeriodId: string;
  type: TaxDocumentType;
  documents: TaxDocument[];
  loading: boolean;
  refresh: () => unknown;
}) {
  const [discarding, setDiscarding] = useState<TaxDocument | null>(null);
  const [reason, setReason] = useState("");
  const [discardError, setDiscardError] = useState<string | null>(null);
  const [discardLoading, setDiscardLoading] = useState(false);
  const downloadOriginal = async (fileId: string) => {
    const response = await filesApi.downloadUrl(companyId, fileId);
    window.location.assign(response.downloadUrl);
  };
  const discard = async () => {
    if (!discarding || reason.trim().length < 3 || discardLoading) return;
    setDiscardLoading(true);
    setDiscardError(null);
    try {
      await accountingService.discardDocument(
        companyId,
        taxPeriodId,
        discarding.id,
        reason.trim(),
      );
      await refresh();
      setDiscarding(null);
      setReason("");
    } catch (error) {
      setDiscardError(
        error instanceof Error
          ? error.message
          : "No fue posible descartar la versión.",
      );
    } finally {
      setDiscardLoading(false);
    }
  };
  return (
    <section className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b p-5">
        <h2 className="font-semibold">Historial de {contracts[type].title}</h2>
      </div>
      {loading ? (
        <p className="flex items-center gap-2 p-6 text-sm">
          <LoaderCircle className="size-4 animate-spin" />
          Cargando historial…
        </p>
      ) : documents.length === 0 ? (
        <div className="p-6">
          <p className="text-sm text-slate-600">
            Aún no existen versiones de este documento para el período
            seleccionado.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            La primera carga quedará registrada como versión 1.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Versiones de {contracts[type].title}
            </caption>
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Versión",
                  "Archivo",
                  "Fecha",
                  "Usuario",
                  "Estado",
                  "Filas",
                  "Errores",
                  "Warnings",
                  "Acciones",
                ].map((label) => (
                  <th key={label} className="px-4 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-t">
                  <td className="px-4 py-3">v{document.versionNumber}</td>
                  <td
                    className="max-w-52 truncate px-4 py-3"
                    title={document.storedFile.originalName}
                  >
                    {document.storedFile.originalName}
                  </td>
                  <td className="px-4 py-3">
                    {new Date(document.uploadedAt).toLocaleDateString("es-CL")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-medium">
                      {document.uploadedBy?.name ?? "Usuario no disponible"}
                    </span>
                    <span className="text-xs text-slate-500">
                      {document.uploadedBy?.email}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {statusPresentation(document.status).label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {document.metadata?.rowsRead ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {document.metadata?.errors?.length ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    {document.metadata?.warnings?.length ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/companies/${companyId}/periods/${taxPeriodId}/documents/${document.id}`}
                        className="rounded border px-2 py-1"
                      >
                        Ver detalle
                      </Link>
                      {explorerDocumentPath(
                        companyId,
                        taxPeriodId,
                        document,
                      ) && (
                        <Link
                          href={explorerDocumentPath(
                            companyId,
                            taxPeriodId,
                            document,
                          )!}
                          className="rounded border border-emerald-300 px-2 py-1 text-emerald-800"
                        >
                          {type === "balance"
                            ? "Ver Balance"
                            : "Ver en explorador contable"}
                        </Link>
                      )}
                      <Link
                        href={`/companies/${companyId}/periods/${taxPeriodId}/documents/${document.id}/report`}
                        className="rounded border px-2 py-1"
                      >
                        Ver reporte
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          void downloadOriginal(document.storedFile.id)
                        }
                        className="rounded border px-2 py-1"
                      >
                        Descargar original
                      </button>
                      {type === "balance" &&
                        document.status !== "discarded" && (
                          <button
                            type="button"
                            onClick={() => {
                              setDiscarding(document);
                              setReason("");
                              setDiscardError(null);
                            }}
                            className="rounded border border-red-300 px-2 py-1 text-red-700"
                          >
                            Descartar versión
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {discarding && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="discard-title"
        >
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 id="discard-title" className="text-xl font-semibold">
              Descartar versión del Balance
            </h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Metric
                label="Archivo"
                value={discarding.storedFile.originalName}
              />
              <Metric label="Versión" value={`v${discarding.versionNumber}`} />
              <Metric
                label="Fecha"
                value={new Date(discarding.uploadedAt).toLocaleDateString(
                  "es-CL",
                )}
              />
              <Metric
                label="Usuario"
                value={discarding.uploadedBy?.name ?? "No disponible"}
              />
              <Metric
                label="Estado"
                value={statusPresentation(discarding.status).label}
              />
              <Metric
                label="Filas"
                value={discarding.metadata?.rowsRead ?? 0}
              />
              <Metric
                label="Errores / warnings"
                value={`${discarding.metadata?.errors?.length ?? 0} / ${discarding.metadata?.warnings?.length ?? 0}`}
              />
              <Metric label="Período tributario" value={taxPeriodId} />
            </dl>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Esta versión dejará de utilizarse en el período. El archivo y su
              historial se conservarán. Los mappings confirmados no serán
              eliminados.
            </p>
            <label className="mt-4 block text-sm font-medium">
              Motivo obligatorio
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={discardLoading}
                className="mt-1 min-h-24 w-full rounded-lg border p-2"
              />
            </label>
            {discardError && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {discardError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={discardLoading}
                onClick={() => setDiscarding(null)}
                className="rounded-lg border px-4 py-2"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={discardLoading || reason.trim().length < 3}
                onClick={() => void discard()}
                className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-50"
              >
                {discardLoading && (
                  <LoaderCircle className="size-4 animate-spin" />
                )}
                Descartar versión
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
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

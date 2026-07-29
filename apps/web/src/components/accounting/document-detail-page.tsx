"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRef, useState } from "react";
import { filesApi } from "../../../lib/files/files-api";
import {
  canReviewMappings,
  statusPresentation,
} from "@/lib/accounting-presentation";
import { accountingService } from "@/services/accounting.service";

export function DocumentDetailPage({
  companyId,
  taxPeriodId,
  documentId,
}: {
  companyId: string;
  taxPeriodId: string;
  documentId: string;
}) {
  const queryClient = useQueryClient();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [processing, setProcessing] = useState(false);
  const query = useQuery({
    queryKey: ["tax-document", companyId, taxPeriodId, documentId],
    queryFn: () =>
      accountingService.document(companyId, taxPeriodId, documentId),
  });
  if (query.isLoading) return <main className="p-8">Cargando documento…</main>;
  if (!query.data)
    return (
      <main className="p-8" role="alert">
        Documento no encontrado.
      </main>
    );
  const document = query.data;
  const report = document.metadata;
  const invalid =
    document.status === "invalid" ||
    document.status === "processing_error" ||
    ((report?.errors?.length ?? 0) > 0 && (report?.validRows ?? 0) === 0);
  const busy = ["uploaded", "validating", "processing"].includes(
    document.status,
  );
  const status = statusPresentation(document.status);
  const downloadOriginal = async () => {
    const response = await filesApi.downloadUrl(
      companyId,
      document.storedFile.id,
    );
    window.location.assign(response.downloadUrl);
  };
  const reprocess = async () => {
    setProcessing(true);
    try {
      await accountingService.processDocument(
        companyId,
        taxPeriodId,
        documentId,
      );
      await queryClient.invalidateQueries({
        queryKey: ["tax-document", companyId, taxPeriodId, documentId],
      });
      dialogRef.current?.close();
    } finally {
      setProcessing(false);
    }
  };
  const downloadReport = () => {
    const blob = new Blob([JSON.stringify(report ?? {}, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = `reporte-${document.documentType}-v${document.versionNumber}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-8">
      <header>
        <Link
          href={`/companies/${companyId}/periods/${taxPeriodId}/documents`}
          className="text-sm text-emerald-700"
        >
          ← Volver a documentos
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">
              {document.storedFile.originalName}
            </h1>
            <p className="mt-1 text-slate-600">
              {document.documentType} · v{document.versionNumber} · Empresa{" "}
              {companyId} · Período tributario
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${status.variant === "danger" ? "bg-red-100 text-red-800" : status.variant === "success" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}
          >
            {status.label}
          </span>
        </div>
      </header>
      <section
        className={`mt-6 rounded-xl border p-5 ${invalid ? "border-red-300 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}
        role={invalid ? "alert" : undefined}
      >
        <h2 className="text-lg font-semibold">
          {invalid
            ? "Importación rechazada"
            : busy
              ? "Importación en curso"
              : "Resumen de importación"}
        </h2>
        {invalid && (
          <p className="mt-2">
            El archivo fue recibido, pero no pudo importarse porque contiene
            errores de validación.
          </p>
        )}
        {invalid && (report?.validRows ?? 0) === 0 && (
          <p className="mt-1 font-medium">
            No se importó ninguna fila. El archivo contiene{" "}
            {report?.errors?.length ?? 0} errores de validación.
          </p>
        )}
        {busy && (
          <p className="mt-2">
            El documento está siendo procesado. Las acciones incompatibles
            permanecerán deshabilitadas.
          </p>
        )}
        <dl className="mt-4 grid gap-3 sm:grid-cols-5">
          <Metric label="Filas leídas" value={report?.rowsRead} />
          <Metric label="Filas válidas" value={report?.validRows} />
          <Metric
            label="Filas inválidas"
            value={(report?.rowsRead ?? 0) - (report?.validRows ?? 0)}
          />
          <Metric label="Errores" value={report?.errors?.length ?? 0} />
          <Metric label="Warnings" value={report?.warnings?.length ?? 0} />
        </dl>
      </section>
      {document.documentType === "balance" &&
        document.status === "processed" &&
        (report?.warnings?.length ?? 0) > 0 && (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-amber-900">
            Este Balance fue procesado con advertencias.
          </p>
        )}
      <section className="mt-5 rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Información del documento</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <Metric
            label="Usuario"
            value={document.uploadedBy?.name ?? "Usuario no disponible"}
          />
          <Metric label="Correo" value={document.uploadedBy?.email} />
          <Metric
            label="Fecha y hora"
            value={new Date(document.uploadedAt).toLocaleString("es-CL")}
          />
          <Metric
            label="Tamaño"
            value={`${document.storedFile.sizeBytes} bytes`}
          />
          <Metric
            label="Documento reemplazado"
            value={document.replacesDocumentId}
          />
          <Metric
            label="Documento reemplazante"
            value={document.replacedByDocumentId}
          />
        </dl>
      </section>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={`/companies/${companyId}/periods/${taxPeriodId}/documents/${documentId}/report`}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          {invalid ? "Ver reporte de errores" : "Ver reporte"}
        </Link>
        <button
          type="button"
          onClick={() => void downloadOriginal()}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Descargar original
        </button>
        {invalid && (
          <button
            type="button"
            onClick={downloadReport}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Descargar reporte
          </button>
        )}
        {invalid && (
          <Link
            href={`/companies/${companyId}/periods/${taxPeriodId}/documents`}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Cargar nueva versión
          </Link>
        )}
        {["invalid", "processing_error"].includes(document.status) && (
          <button
            type="button"
            onClick={() => dialogRef.current?.showModal()}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            {document.status === "processing_error"
              ? "Reintentar procesamiento"
              : "Reprocesar"}
          </button>
        )}
        {canReviewMappings(document.documentType, document.status, report) && (
          <Link
            href={`/companies/${companyId}/periods/${taxPeriodId}/account-mapping?documentId=${documentId}`}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white"
          >
            Revisar homologaciones
          </Link>
        )}
      </div>
      <dialog
        ref={dialogRef}
        aria-labelledby="reprocess-title"
        className="m-auto rounded-xl p-0 backdrop:bg-slate-900/40"
      >
        <form method="dialog" className="max-w-md p-6">
          <h2 id="reprocess-title" className="text-lg font-semibold">
            Confirmar reprocesamiento
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Se volverá a validar el archivo original y se actualizará su
            reporte.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="rounded-lg border px-4 py-2">Cancelar</button>
            <button
              type="button"
              disabled={processing}
              onClick={() => void reprocess()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
            >
              {processing ? "Procesando…" : "Reprocesar"}
            </button>
          </div>
        </form>
      </dialog>
    </main>
  );
}
function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="font-semibold">
        {value === null || value === undefined || value === ""
          ? "—"
          : String(value)}
      </dd>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { filesApi, FilesApi } from "../../lib/files/files-api";
import type { CompanyFile } from "../../lib/files/types";
import { getFilesViewState } from "../../lib/files/view-state";
import { FileList } from "./file-list";
import { UploadDialog } from "./upload-dialog";

const configuredMax = Number(
  process.env.NEXT_PUBLIC_MAX_FILE_SIZE_BYTES ?? "52428800",
);
const maxSizeBytes =
  Number.isFinite(configuredMax) && configuredMax > 0
    ? configuredMax
    : 52428800;
interface Props {
  companyId: string;
  api?: FilesApi;
}

export function FilesPage({ companyId, api = filesApi }: Props) {
  const [files, setFiles] = useState<CompanyFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setFiles(await api.list(companyId));
    } catch {
      setError("No pudimos cargar los archivos. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  }, [api, companyId]);
  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  async function download(file: CompanyFile) {
    if (downloadingId) return;
    setDownloadingId(file.id);
    setError("");
    try {
      const { downloadUrl } = await api.downloadUrl(companyId, file.id);
      window.location.assign(downloadUrl);
    } catch {
      setError("No pudimos preparar la descarga. Inténtalo nuevamente.");
    } finally {
      setDownloadingId(null);
    }
  }

  const viewState = getFilesViewState(loading, error, files);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Archivos</h1>
          <p className="description">
            Archivos contables asociados a la empresa.
          </p>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => {
            setSuccess("");
            setShowUpload(true);
          }}
        >
          Subir archivo
        </button>
      </div>
      {error && (
        <div className="alert" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="alert success" role="status">
          {success}
        </div>
      )}
      <section className="card" aria-label="Archivos de la empresa">
        {viewState === "loading" ? (
          <div className="table-wrap">
            <table aria-label="Cargando archivos">
              <tbody>
                {Array.from({ length: 4 }, (_, row) => (
                  <tr key={row}>
                    {Array.from({ length: 7 }, (_, cell) => (
                      <td key={cell}>
                        <div className="skeleton" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : viewState === "error" ? (
          <div className="state">
            <div className="state-icon">!</div>
            <h2>No se pudieron cargar los archivos</h2>
            <p>Revisa tu conexión y vuelve a intentarlo.</p>
            <button
              className="button button-secondary"
              onClick={() => void loadFiles()}
            >
              Reintentar
            </button>
          </div>
        ) : viewState === "empty" ? (
          <div className="state">
            <div className="state-icon">↥</div>
            <h2>Aún no hay archivos</h2>
            <p>Sube el primer archivo contable de esta empresa.</p>
            <button
              className="button button-secondary"
              onClick={() => setShowUpload(true)}
            >
              Subir archivo
            </button>
          </div>
        ) : (
          <FileList
            files={files}
            downloadingId={downloadingId}
            onDownload={(file) => void download(file)}
          />
        )}
      </section>
      {showUpload && (
        <UploadDialog
          companyId={companyId}
          api={api}
          maxSizeBytes={maxSizeBytes}
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setSuccess("El archivo se cargó correctamente.");
            void loadFiles();
          }}
        />
      )}
    </main>
  );
}

import {
  categoryLabels,
  formatCreatedAt,
  formatFileSize,
  statusLabels,
} from "../../lib/files/formatters";
import type { CompanyFile } from "../../lib/files/types";

interface Props {
  files: CompanyFile[];
  downloadingId: string | null;
  onDownload: (file: CompanyFile) => void;
}

export function FileList({ files, downloadingId, onDownload }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Tipo</th>
            <th>Tamaño</th>
            <th>Fecha de carga</th>
            <th>Estado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {files.map((file) => (
            <tr key={file.id}>
              <td className="file-name" title={file.originalName}>
                {file.originalName}
              </td>
              <td>{categoryLabels[file.category]}</td>
              <td>{file.extension ? file.extension.toUpperCase() : "—"}</td>
              <td>{formatFileSize(file.sizeBytes)}</td>
              <td>{formatCreatedAt(file.createdAt)}</td>
              <td>
                <span className={`badge badge-${file.status}`}>
                  {statusLabels[file.status]}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  className="button button-link"
                  disabled={downloadingId === file.id}
                  onClick={() => onDownload(file)}
                >
                  {downloadingId === file.id ? "Generando…" : "Descargar"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

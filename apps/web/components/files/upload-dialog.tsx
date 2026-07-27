'use client';

import { FormEvent, useRef, useState } from 'react';
import type { FilesApi } from '../../lib/files/files-api';
import { categoryLabels, formatFileSize } from '../../lib/files/formatters';
import { fileCategories, FileCategory, UploadStage } from '../../lib/files/types';
import { uploadCompanyFile, validateUpload } from '../../lib/files/upload-file';

const stages: Record<UploadStage, string> = { idle: '', preparing: 'Preparando', uploading: 'Subiendo', confirming: 'Confirmando', completed: 'Completado' };
type Errors = { file?: string; category?: string; submit?: string };

interface Props { companyId: string; api: FilesApi; maxSizeBytes: number; onClose: () => void; onUploaded: () => void }

export function UploadDialog({ companyId, api, maxSizeBytes, onClose, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<FileCategory | ''>('');
  const [errors, setErrors] = useState<Errors>({});
  const [stage, setStage] = useState<UploadStage>('idle');
  const [progress, setProgress] = useState(0);
  const submitting = useRef(false);
  const busy = stage !== 'idle' && stage !== 'completed';

  function validate(): boolean {
    const next: Errors = validateUpload(file, category, maxSizeBytes);
    if (next.file?.includes('tamaño máximo')) next.file = `El archivo supera el máximo de ${formatFileSize(String(maxSizeBytes))}.`;
    setErrors(next); return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || !validate() || !file || !category) return;
    submitting.current = true;
    const uploadPhase = { failedAtStorage: false };
    try {
      await uploadCompanyFile(api, companyId, file, category, {
        onProgress: setProgress,
        onStage: (nextStage) => { uploadPhase.failedAtStorage = nextStage === 'uploading'; setStage(nextStage); },
      });
      onUploaded();
    } catch {
      setErrors({ submit: uploadPhase.failedAtStorage ? 'No se pudo subir el archivo al almacenamiento. Inténtalo nuevamente.' : 'No se pudo completar la carga. Inténtalo nuevamente.' });
      setStage('idle');
    } finally { submitting.current = false; }
  }

  return <div className="overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <h2 id="upload-title">Subir archivo</h2><p className="modal-intro">Agrega un archivo contable a esta empresa.</p>
      {errors.submit && <div className="alert" role="alert">{errors.submit}</div>}
      {stage === 'completed' ? <div className="alert success" role="status">El archivo se cargó correctamente.</div> : <form onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="file">Archivo</label><input id="file" type="file" disabled={busy} onChange={(event) => { setFile(event.target.files?.[0] ?? null); setErrors((old) => ({ ...old, file: undefined })); }} />
          <p className="hint">Tamaño máximo: {formatFileSize(String(maxSizeBytes))}</p>{errors.file && <p className="field-error">{errors.file}</p>}</div>
        <div className="field"><label htmlFor="category">Categoría</label><select id="category" value={category} disabled={busy} onChange={(event) => { setCategory(event.target.value as FileCategory); setErrors((old) => ({ ...old, category: undefined })); }}><option value="">Selecciona una categoría</option>{fileCategories.map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}</select>{errors.category && <p className="field-error">{errors.category}</p>}</div>
        {busy && <div aria-live="polite"><div className="progress-label"><span>{stages[stage]}</span><span>{stage === 'uploading' ? `${progress}%` : ''}</span></div><div className="progress-track"><div className="progress-bar" style={{ width: stage === 'preparing' ? '15%' : stage === 'confirming' ? '90%' : `${Math.max(progress, 25)}%` }} /></div></div>}
        <div className="actions"><button className="button button-secondary" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="button" type="submit" disabled={busy}>{busy ? stages[stage] : 'Subir archivo'}</button></div>
      </form>}
      {stage === 'completed' && <div className="actions"><button type="button" className="button" onClick={onClose}>Cerrar</button></div>}
    </section>
  </div>;
}

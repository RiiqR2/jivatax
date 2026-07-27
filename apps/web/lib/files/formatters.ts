import type { FileCategory, FileStatus } from './types';

export const categoryLabels: Record<FileCategory, string> = {
  balance: 'Balance', journal: 'Libro diario', ledger: 'Libro mayor', xml: 'XML', other: 'Otro',
};
export const statusLabels: Record<FileStatus, string> = {
  uploaded: 'Cargado', processing: 'Procesando', processed: 'Procesado', failed: 'Error', generated: 'Generado',
};

export function formatFileSize(value: string): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(size)} ${units[unit]}`;
}

export function formatCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

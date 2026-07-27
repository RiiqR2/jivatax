import type { CompanyFile } from './types';

export type FilesViewState = 'loading' | 'error' | 'empty' | 'list';

export function getFilesViewState(loading: boolean, error: string, files: CompanyFile[]): FilesViewState {
  if (loading) return 'loading';
  if (error && files.length === 0) return 'error';
  if (files.length === 0) return 'empty';
  return 'list';
}

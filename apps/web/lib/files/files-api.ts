import { apiRequest } from '../http/api-client';
import type { CompanyFile, DownloadUrlResponse, FileMetadata, UploadUrlResponse } from './types';

const path = (companyId: string) => `/companies/${encodeURIComponent(companyId)}/files`;

export const filesApi = {
  list: (companyId: string) => apiRequest<CompanyFile[]>(path(companyId)),
  createUploadUrl: (companyId: string, metadata: FileMetadata) => apiRequest<UploadUrlResponse>(`${path(companyId)}/upload-url`, { method: 'POST', body: JSON.stringify(metadata) }),
  complete: (companyId: string, payload: FileMetadata & { objectKey: string }) => apiRequest<CompanyFile>(`${path(companyId)}/complete`, { method: 'POST', body: JSON.stringify(payload) }),
  downloadUrl: (companyId: string, fileId: string) => apiRequest<DownloadUrlResponse>(`${path(companyId)}/${encodeURIComponent(fileId)}/download-url`),
  uploadToStorage(uploadUrl: string, file: File, onProgress: (percentage: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', uploadUrl);
      if (file.type) request.setRequestHeader('Content-Type', file.type);
      request.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      });
      request.addEventListener('load', () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('storage upload failed')));
      request.addEventListener('error', () => reject(new Error('storage upload failed')));
      request.addEventListener('abort', () => reject(new Error('storage upload aborted')));
      request.send(file);
    });
  },
};
export type FilesApi = typeof filesApi;

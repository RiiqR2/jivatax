import type { FilesApi } from "./files-api";
import type { FileCategory, FileMetadata, UploadStage } from "./types";

export interface UploadCallbacks {
  onStage: (stage: UploadStage) => void;
  onProgress: (percentage: number) => void;
}

export async function uploadCompanyFile(
  api: FilesApi,
  companyId: string,
  file: File,
  category: FileCategory,
  callbacks: UploadCallbacks,
): Promise<void> {
  const metadata: FileMetadata = {
    originalName: file.name,
    contentType: file.type || "application/octet-stream",
    sizeBytes: String(file.size),
    category,
  };
  callbacks.onStage("preparing");
  const { uploadUrl, objectKey } = await api.createUploadUrl(
    companyId,
    metadata,
  );
  callbacks.onStage("uploading");
  await api.uploadToStorage(uploadUrl, file, callbacks.onProgress);
  callbacks.onStage("confirming");
  await api.complete(companyId, { ...metadata, objectKey });
  callbacks.onProgress(100);
  callbacks.onStage("completed");
}

export function validateUpload(
  file: File | null,
  category: FileCategory | "",
  maxSizeBytes: number,
) {
  const errors: { file?: string; category?: string } = {};
  if (!file) errors.file = "Selecciona un archivo.";
  else if (file.size > maxSizeBytes)
    errors.file = "El archivo supera el tamaño máximo permitido.";
  if (!category) errors.category = "Selecciona una categoría.";
  return errors;
}

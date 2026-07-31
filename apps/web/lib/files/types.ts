export const fileCategories = [
  "balance",
  "journal",
  "ledger",
  "xml",
  "other",
] as const;
export type FileCategory = (typeof fileCategories)[number];
export type FileStatus =
  "uploaded" | "processing" | "processed" | "failed" | "generated";

export interface CompanyFile {
  id: string;
  originalName: string;
  extension: string;
  contentType: string;
  sizeBytes: string;
  category: FileCategory;
  direction: "input";
  status: FileStatus;
  createdAt: string;
}

export interface FileMetadata {
  originalName: string;
  contentType: string;
  sizeBytes: string;
  category: FileCategory;
}

export interface UploadUrlResponse {
  objectKey: string;
  uploadUrl: string;
  expiresIn: number;
}
export interface DownloadUrlResponse {
  downloadUrl: string;
  expiresIn: number;
}
export type UploadStage =
  "idle" | "preparing" | "uploading" | "confirming" | "completed";

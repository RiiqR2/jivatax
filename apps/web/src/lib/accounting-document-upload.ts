import type { FilesApi } from "../../lib/files/files-api.ts";
import type { CompanyFile, FileCategory } from "../../lib/files/types.ts";
import type {
  TaxDocument,
  TaxDocumentReport,
  TaxDocumentType,
  BalanceRole,
} from "../types/accounting.types.ts";

export const MAX_ACCOUNTING_FILE_SIZE = 25 * 1024 * 1024;

export function buildCreateDocumentPayload(
  documentType: TaxDocumentType,
  storedFileId: string,
  balanceRole?: BalanceRole,
) {
  const payload: {
    documentType: TaxDocumentType;
    storedFileId: string;
    balanceRole?: BalanceRole;
  } = { documentType, storedFileId };
  if (documentType === "balance" && balanceRole)
    payload.balanceRole = balanceRole;
  return payload;
}
const allowedExtensions = ["xls", "xlsx", "csv"];
const allowedMimeTypes = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "application/csv",
  "application/octet-stream",
];

export type AccountingUploadStage =
  | "idle"
  | "selected"
  | "preparing"
  | "uploading"
  | "uploaded"
  | "validating"
  | "processing"
  | "processed"
  | "processed_with_warnings"
  | "validation_error"
  | "processing_error";

export function validateAccountingFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (file.size === 0) return "El archivo está vacío.";
  if (file.size > MAX_ACCOUNTING_FILE_SIZE)
    return "El archivo supera el tamaño máximo de 25 MB.";
  if (!allowedExtensions.includes(extension))
    return "Selecciona un archivo XLS, XLSX o CSV.";
  if (file.type && !allowedMimeTypes.includes(file.type))
    return "El tipo MIME del archivo no corresponde a XLS, XLSX o CSV.";
  return null;
}

export function categoryForDocument(type: TaxDocumentType): FileCategory {
  return type === "general_ledger" ? "ledger" : type;
}

type UploadDependencies = {
  files: Pick<FilesApi, "createUploadUrl" | "uploadToStorage" | "complete">;
  accounting: {
    createDocument: (
      companyId: string,
      periodId: string,
      documentType: TaxDocumentType,
      storedFileId: string,
      balanceRole?: BalanceRole,
    ) => Promise<TaxDocument>;
    processDocument: (
      companyId: string,
      periodId: string,
      documentId: string,
    ) => Promise<TaxDocumentReport>;
    document: (
      companyId: string,
      periodId: string,
      documentId: string,
    ) => Promise<TaxDocument>;
  };
};

export async function processAccountingFile(
  companyId: string,
  taxPeriodId: string,
  documentType: TaxDocumentType,
  file: File,
  callbacks: {
    onStage: (stage: AccountingUploadStage) => void;
    onProgress: (percentage: number) => void;
  },
  dependencies: UploadDependencies,
  balanceRole?: BalanceRole,
): Promise<{ document: TaxDocument; report: TaxDocumentReport }> {
  const validationError = validateAccountingFile(file);
  if (validationError) throw new Error(validationError);
  const metadata = {
    originalName: file.name,
    contentType: file.type || "application/octet-stream",
    sizeBytes: String(file.size),
    category: categoryForDocument(documentType),
  };
  callbacks.onStage("preparing");
  const signedUpload = await dependencies.files.createUploadUrl(
    companyId,
    metadata,
  );
  callbacks.onStage("uploading");
  await dependencies.files.uploadToStorage(
    signedUpload.uploadUrl,
    file,
    callbacks.onProgress,
  );
  const completionPayload = {
    originalName: metadata.originalName,
    contentType: metadata.contentType,
    sizeBytes: metadata.sizeBytes,
    category: metadata.category,
    objectKey: signedUpload.objectKey,
  };
  const storedFile: CompanyFile = await dependencies.files.complete(
    companyId,
    completionPayload,
  );
  callbacks.onProgress(100);
  callbacks.onStage("uploaded");
  const document = await dependencies.accounting.createDocument(
    companyId,
    taxPeriodId,
    documentType,
    storedFile.id,
    balanceRole,
  );
  callbacks.onStage("validating");
  await Promise.resolve();
  callbacks.onStage("processing");
  const report = await dependencies.accounting.processDocument(
    companyId,
    taxPeriodId,
    document.id,
  );
  const processedDocument = await dependencies.accounting.document(
    companyId,
    taxPeriodId,
    document.id,
  );
  const terminalStage =
    processedDocument.status === "invalid"
      ? "validation_error"
      : processedDocument.status === "processing_error"
        ? "processing_error"
        : (report.warnings?.length ?? 0) > 0
          ? "processed_with_warnings"
          : "processed";
  callbacks.onStage(terminalStage);
  return { document: processedDocument, report };
}

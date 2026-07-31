import assert from "node:assert/strict";
import test from "node:test";
import { formatCreatedAt, formatFileSize } from "../lib/files/formatters.ts";
import type { FilesApi } from "../lib/files/files-api.ts";
import type { CompanyFile } from "../lib/files/types.ts";
import { uploadCompanyFile, validateUpload } from "../lib/files/upload-file.ts";
import { getFilesViewState } from "../lib/files/view-state.ts";

const companyFile: CompanyFile = {
  id: "file-1",
  originalName: "balance-2025.xlsx",
  extension: "xlsx",
  contentType:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  sizeBytes: "1048576",
  category: "balance",
  direction: "input",
  status: "uploaded",
  createdAt: "2025-03-14T15:30:00.000Z",
};

test("representa el listado con datos y sus valores formateados", () => {
  assert.equal(getFilesViewState(false, "", [companyFile]), "list");
  assert.equal(formatFileSize(companyFile.sizeBytes), "1 MB");
  assert.notEqual(formatCreatedAt(companyFile.createdAt), "—");
});

test("representa el estado vacío", () => {
  assert.equal(getFilesViewState(false, "", []), "empty");
});

test("valida archivo y categoría obligatorios y el tamaño máximo", () => {
  assert.deepEqual(validateUpload(null, "", 10), {
    file: "Selecciona un archivo.",
    category: "Selecciona una categoría.",
  });
  const oversized = new File(["contenido"], "balance.xlsx");
  assert.ok(validateUpload(oversized, "balance", 2).file);
});

test("ejecuta upload-url, PUT y complete en orden", async () => {
  const calls: string[] = [];
  const api = {
    createUploadUrl: async () => {
      calls.push("upload-url");
      return {
        uploadUrl: "https://storage.test/upload",
        objectKey: "private-key",
        expiresIn: 900,
      };
    },
    uploadToStorage: async () => {
      calls.push("PUT");
    },
    complete: async (_companyId: string, payload: { objectKey: string }) => {
      calls.push(`complete:${payload.objectKey}`);
      return companyFile;
    },
  } as FilesApi;
  await uploadCompanyFile(
    api,
    "company-1",
    new File(["ok"], "balance.xlsx", { type: "application/xlsx" }),
    "balance",
    { onStage: () => {}, onProgress: () => {} },
  );
  assert.deepEqual(calls, ["upload-url", "PUT", "complete:private-key"]);
});

test("detiene el flujo cuando falla la subida al storage", async () => {
  let completed = false;
  const api = {
    createUploadUrl: async () => ({
      uploadUrl: "https://storage.test/upload",
      objectKey: "key",
      expiresIn: 900,
    }),
    uploadToStorage: async () => {
      throw new Error("storage failed");
    },
    complete: async () => {
      completed = true;
      return companyFile;
    },
  } as FilesApi;
  await assert.rejects(
    uploadCompanyFile(api, "company-1", new File(["x"], "file.xml"), "xml", {
      onStage: () => {},
      onProgress: () => {},
    }),
  );
  assert.equal(completed, false);
});

test("solicita la URL de descarga con empresa y archivo", async () => {
  const requested: string[] = [];
  const api = {
    downloadUrl: async (companyId: string, fileId: string) => {
      requested.push(companyId, fileId);
      return { downloadUrl: "https://storage.test/download", expiresIn: 900 };
    },
  } as FilesApi;
  const result = await api.downloadUrl("company-1", "file-1");
  assert.deepEqual(requested, ["company-1", "file-1"]);
  assert.equal(result.downloadUrl, "https://storage.test/download");
});

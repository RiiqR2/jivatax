import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MAX_ACCOUNTING_FILE_SIZE,
  processAccountingFile,
  validateAccountingFile,
} from "../src/lib/accounting-document-upload.ts";

const makeFile = (name: string, size: number, type: string) =>
  new File([new Uint8Array(size)], name, { type });

test("valida extensión, archivo vacío y tamaño", () => {
  assert.match(
    validateAccountingFile(makeFile("balance.pdf", 10, "application/pdf")) ??
      "",
    /XLS/,
  );
  assert.match(
    validateAccountingFile(
      makeFile(
        "balance.xlsx",
        0,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ) ?? "",
    /vacío/,
  );
  assert.match(
    validateAccountingFile(
      makeFile("balance.csv", MAX_ACCOUNTING_FILE_SIZE + 1, "text/csv"),
    ) ?? "",
    /25 MB/,
  );
  assert.equal(
    validateAccountingFile(makeFile("balance.csv", 10, "text/csv")),
    null,
  );
});

test("ejecuta signed URL, storage, stored_file, tax_document y procesamiento en orden", async () => {
  const calls: string[] = [];
  const stages: string[] = [];
  const selected = makeFile("balance.csv", 10, "text/csv");
  const dependencies = {
    files: {
      async createUploadUrl() {
        calls.push("signed-url");
        return { uploadUrl: "url", objectKey: "key", expiresIn: 60 };
      },
      async uploadToStorage(
        _url: string,
        _file: File,
        progress: (value: number) => void,
      ) {
        calls.push("storage-put");
        progress(75);
      },
      async complete() {
        calls.push("stored-file");
        return {
          id: "file-1",
          originalName: selected.name,
          extension: "csv",
          contentType: selected.type,
          sizeBytes: "10",
          category: "balance" as const,
          direction: "input" as const,
          status: "uploaded" as const,
          createdAt: new Date().toISOString(),
        };
      },
    },
    accounting: {
      async createDocument() {
        calls.push("tax-document");
        return { id: "document-1" } as never;
      },
      async processDocument() {
        calls.push("process");
        return { rowsRead: 2, validRows: 2, warnings: [] };
      },
      async document() {
        calls.push("status");
        return {
          id: "document-1",
          status: "processed",
          versionNumber: 1,
        } as never;
      },
    },
  };
  await processAccountingFile(
    "company",
    "period",
    "balance",
    selected,
    { onStage: (stage) => stages.push(stage), onProgress: () => undefined },
    dependencies,
  );
  assert.deepEqual(calls, [
    "signed-url",
    "storage-put",
    "stored-file",
    "tax-document",
    "process",
    "status",
  ]);
  assert.deepEqual(stages, [
    "preparing",
    "uploading",
    "uploaded",
    "validating",
    "processing",
    "processed",
  ]);
});

test("detiene el flujo ante error de upload", async () => {
  const calls: string[] = [];
  await assert.rejects(
    processAccountingFile(
      "company",
      "period",
      "balance",
      makeFile("balance.csv", 10, "text/csv"),
      { onStage: () => undefined, onProgress: () => undefined },
      {
        files: {
          async createUploadUrl() {
            calls.push("signed-url");
            return { uploadUrl: "url", objectKey: "key", expiresIn: 60 };
          },
          async uploadToStorage() {
            calls.push("storage-put");
            throw new Error("upload failed");
          },
          async complete() {
            calls.push("stored-file");
            throw new Error("unexpected");
          },
        },
        accounting: {
          async createDocument() {
            calls.push("tax-document");
            throw new Error("unexpected");
          },
          async processDocument() {
            calls.push("process");
            return {};
          },
          async document() {
            calls.push("status");
            throw new Error("unexpected");
          },
        },
      },
    ),
    /upload failed/,
  );
  assert.deepEqual(calls, ["signed-url", "storage-put"]);
});

test("la UI deja formato cerrado y ofrece dropzone, Procesar e historial primero", () => {
  const source = readFileSync(
    new URL("../src/components/accounting/documents-page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /<label[\s\S]*htmlFor="accounting-document-file"/);
  assert.match(source, /aria-expanded=\{formatOpen\}/);
  assert.match(source, /onDrop=/);
  assert.match(source, /Procesar \{contract\.shortName\}/);
  assert.ok(
    source.indexOf("<History") < source.indexOf("aria-expanded={formatOpen}"),
  );
});

test("sidebar fija viewport, scroll interno y footer", () => {
  const source = readFileSync(
    new URL("../src/components/layout/app-sidebar.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /sticky top-0/);
  assert.match(source, /h-screen/);
  assert.match(source, /overflow-y-auto/);
  assert.match(source, /<footer className="shrink-0/);
});

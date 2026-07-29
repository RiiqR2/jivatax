"use client";

import axios from "axios";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { useImportAccountPlan } from "@/hooks/use-company-account-plan";
import { companyAccountPlanService } from "@/services/company-account-plan.service";

const FORMAT_COLUMNS = [
  {
    name: "Código",
    required: "Requerido",
    type: "Texto",
    example: "001-01",
  },
  {
    name: "Nombre",
    required: "Requerido",
    type: "Texto",
    example: "Caja General",
  },
  {
    name: "Descripción",
    required: "Opcional",
    type: "Texto",
    example: "Caja principal",
  },
  {
    name: "Nivel",
    required: "Opcional",
    type: "Entero",
    example: "3",
  },
  {
    name: "Código padre",
    required: "Opcional",
    type: "Texto",
    example: "001",
  },
  {
    name: "Estado",
    required: "Opcional",
    type: "active | inactive",
    example: "active",
  },
];

interface ImportValidationError {
  row: number;
  column: string;
  message: string;
}

export function AccountPlanImport({ companyId }: { companyId: string }) {
  const router = useRouter();
  const importPlan = useImportAccountPlan(companyId);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<
    ImportValidationError[]
  >([]);
  const [isDownloading, setIsDownloading] = useState(false);

  async function downloadTemplate() {
    setIsDownloading(true);
    setError(null);
    try {
      await companyAccountPlanService.downloadTemplate(companyId);
    } catch {
      setError("No fue posible descargar la plantilla.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !name.trim()) {
      setError("Selecciona un archivo e ingresa un nombre de versión.");
      return;
    }
    setError(null);
    setValidationErrors([]);
    try {
      const metadata = {
        originalName: file.name,
        contentType: file.type,
        sizeBytes: String(file.size),
        category: "company_account_plan",
      };
      const upload = await api.post<{
        objectKey: string;
        uploadUrl: string;
      }>(`/companies/${companyId}/files/upload-url`, metadata);
      await fetch(upload.data.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });
      const completePayload = {
        originalName: file.name,
        contentType: file.type,
        sizeBytes: String(file.size),
        category: "company_account_plan",
        objectKey: upload.data.objectKey,
      };
      const stored = await api.post<{
        id: string;
      }>(`/companies/${companyId}/files/complete`, completePayload);
      const importPayload = {
        storedFileId: stored.data.id,
        name: name.trim(),
      };
      const result = await importPlan.mutateAsync(importPayload);
      router.push(`/companies/${companyId}/account-plan/${result.versionId}`);
    } catch (caughtError: unknown) {
      if (axios.isAxiosError(caughtError)) {
        const response = caughtError.response?.data as
          | {
              errors?: ImportValidationError[];
            }
          | undefined;
        if (response?.errors?.length) {
          setValidationErrors(response.errors);
          setError("El archivo contiene errores de validación.");
          return;
        }
      }
      setError(
        "No fue posible importar el archivo. Revisa el formato o si ya fue importado.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-5 sm:p-8">
      <PageHeader
        title="Importar plan de cuentas"
        description="Carga una nueva versión sin reemplazar las versiones anteriores."
      />

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Formato esperado
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Puedes utilizar nuestra plantilla o cargar un archivo propio con
              encabezados compatibles.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={isDownloading}
            onClick={downloadTemplate}
          >
            <Download className="mr-2 size-4" />
            {isDownloading ? "Descargando…" : "Descargar plantilla"}
          </Button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-3 py-2 font-semibold">Columna</th>
                <th className="px-3 py-2 font-semibold">Requerida</th>
                <th className="px-3 py-2 font-semibold">Tipo</th>
                <th className="px-3 py-2 font-semibold">Ejemplo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FORMAT_COLUMNS.map((column) => (
                <tr key={column.name}>
                  <td className="px-3 py-2 font-medium">{column.name}</td>
                  <td className="px-3 py-2">{column.required}</td>
                  <td className="px-3 py-2">{column.type}</td>
                  <td className="px-3 py-2 font-mono">{column.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          Los códigos deben mantenerse como texto para conservar ceros
          iniciales.
        </p>
      </section>

      <form
        onSubmit={submit}
        className="mt-6 space-y-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
      >
        <label className="block text-sm font-medium">
          Nombre de versión
          <input
            className="mt-2 w-full rounded-lg border p-2.5 font-normal"
            value={name}
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
            placeholder="Plan de cuentas 2026"
          />
        </label>
        <label className="block text-sm font-medium">
          Archivo
          <input
            className="mt-2 block w-full rounded-lg border p-2.5 font-normal"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <p className="text-sm text-slate-500">
          Formatos permitidos: XLSX, XLS y CSV. Tamaño máximo: 10 MB.
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
        {validationErrors.length > 0 && (
          <ul className="space-y-2 rounded-lg bg-red-50 p-4 text-sm text-red-800">
            {validationErrors.map((validationError, index) => (
              <li
                key={`${validationError.row}-${validationError.column}-${index}`}
              >
                Fila {validationError.row}, {validationError.column}:{" "}
                {validationError.message}
              </li>
            ))}
          </ul>
        )}
        <Button type="submit" disabled={importPlan.isPending}>
          {importPlan.isPending ? "Importando…" : "Importar plan de cuentas"}
        </Button>
      </form>
    </main>
  );
}

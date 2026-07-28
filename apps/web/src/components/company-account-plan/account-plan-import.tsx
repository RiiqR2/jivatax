"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { useImportAccountPlan } from "@/hooks/use-company-account-plan";

export function AccountPlanImport({ companyId }: { companyId: string }) {
  const router = useRouter();
  const importPlan = useImportAccountPlan(companyId);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !name.trim()) {
      setError("Selecciona un archivo e ingresa un nombre de versión.");
      return;
    }
    setError(null);
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
      const stored = await api.post<{ id: string }>(
        `/companies/${companyId}/files/complete`,
        completePayload,
      );
      const result = await importPlan.mutateAsync({
        storedFileId: stored.data.id,
        name: name.trim(),
      });
      router.push(`/companies/${companyId}/account-plan/${result.versionId}`);
    } catch {
      setError(
        "No fue posible importar el archivo. Revisa el formato o si ya fue importado.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-5 sm:p-8">
      <PageHeader
        title="Importar plan de cuentas"
        description="Carga una nueva versión sin reemplazar las versiones anteriores."
      />
      <form
        onSubmit={submit}
        className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-white p-6"
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
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={importPlan.isPending}>
          {importPlan.isPending ? "Importando…" : "Importar plan de cuentas"}
        </Button>
      </form>
    </main>
  );
}

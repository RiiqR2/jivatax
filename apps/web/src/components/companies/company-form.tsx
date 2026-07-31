"use client";
import Link from "next/link";
import axios from "axios";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  companyPayload,
  companySchema,
  type CompanyFormValues,
} from "@/schemas/company.schema";
import type { Company, CompanyInput } from "@/types/company.types";
import { IndustrySelector } from "./industry-selector";
import { useSession } from "@/hooks/use-session";

function apiMessage(error: unknown): string {
  if (!axios.isAxiosError(error)) return "No fue posible guardar la empresa.";
  const status = error.response?.status;
  const message = (
    error.response?.data as { message?: string | string[] } | undefined
  )?.message;
  if (status === 409)
    return "Ya existe una empresa con este RUT en la organización.";
  if (status === 403) return "No tienes permisos para realizar esta acción.";
  if (status === 400 && message)
    return Array.isArray(message) ? message[0] : message;
  return "No fue posible guardar la empresa. Intenta nuevamente.";
}
export function CompanyForm({
  company,
  isPending,
  onSubmit,
  cancelHref = "/companies",
}: {
  company?: Company;
  isPending: boolean;
  onSubmit: (values: CompanyInput) => Promise<void>;
  cancelHref?: string;
}) {
  const session = useSession();
  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      legalName: company?.legalName ?? "",
      tradeName: company?.tradeName ?? "",
      taxId: company?.taxId ?? "",
      status: company?.status ?? "active",
      industryId: company?.industry?.id ?? null,
    },
  });
  const submit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    try {
      await onSubmit(companyPayload(values));
    } catch (error) {
      form.setError("root", { message: apiMessage(error) });
    }
  });
  return (
    <form
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={submit}
      noValidate
    >
      <div>
        <label
          className="text-sm font-medium text-slate-800"
          htmlFor="legalName"
        >
          Razón social
        </label>
        <input
          id="legalName"
          autoComplete="organization"
          className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          placeholder="Servicios Tributarios SpA"
          {...form.register("legalName")}
        />
        {form.formState.errors.legalName && (
          <p className="mt-1 text-sm text-red-700" role="alert">
            {form.formState.errors.legalName.message}
          </p>
        )}
      </div>
      <IndustrySelector
        value={form.watch("industryId") ?? null}
        initial={
          company?.industry
            ? { ...company.industry, normalizedName: company.industry.name }
            : null
        }
        canCreate={session.data?.user.platformRole === "metauser"}
        onChange={(industry) =>
          form.setValue("industryId", industry?.id ?? null, {
            shouldDirty: true,
          })
        }
      />
      <div>
        <label
          className="text-sm font-medium text-slate-800"
          htmlFor="tradeName"
        >
          Nombre de fantasía
        </label>
        <input
          id="tradeName"
          className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          placeholder="Servicios Tributarios"
          {...form.register("tradeName")}
        />
        {form.formState.errors.tradeName && (
          <p className="mt-1 text-sm text-red-700" role="alert">
            {form.formState.errors.tradeName.message}
          </p>
        )}
      </div>
      <div>
        <label className="text-sm font-medium text-slate-800" htmlFor="taxId">
          RUT
        </label>
        <input
          id="taxId"
          className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3 uppercase outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          placeholder="76.123.456-7"
          {...form.register("taxId")}
        />
        <p className="mt-1 text-xs text-slate-500">Ejemplo: 76.123.456-7</p>
        {form.formState.errors.taxId && (
          <p className="mt-1 text-sm text-red-700" role="alert">
            {form.formState.errors.taxId.message}
          </p>
        )}
      </div>
      {company && (
        <div>
          <label
            className="text-sm font-medium text-slate-800"
            htmlFor="status"
          >
            Estado
          </label>
          <select
            id="status"
            className="mt-1 h-11 w-full rounded-lg border border-slate-300 bg-white px-3"
            {...form.register("status")}
          >
            <option value="active">Activa</option>
            <option value="inactive">Inactiva</option>
          </select>
        </div>
      )}
      {form.formState.errors.root && (
        <p
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {form.formState.errors.root.message}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
        <Button asChild variant="outline">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && (
            <LoaderCircle
              aria-hidden="true"
              className="mr-2 size-4 animate-spin"
            />
          )}
          {company ? "Guardar cambios" : "Crear empresa"}
        </Button>
      </div>
    </form>
  );
}

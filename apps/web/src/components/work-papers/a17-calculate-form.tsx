"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { A17_MANUAL_FIELDS, isValidA17Decimal } from "@/lib/work-papers";
import type { A17ManualInput } from "@/types/work-papers.types";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600";

export function A17CalculateForm({
  pending,
  error,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onSubmit: (manualInputs: A17ManualInput[]) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = () => {
    const manualInputs: A17ManualInput[] = [];
    for (const field of A17_MANUAL_FIELDS) {
      const value = values[field.inputKey]?.trim() ?? "";
      if (!value) continue;
      if (!isValidA17Decimal(value)) {
        setLocalError(
          `${field.inputKey} debe ser un decimal con hasta 4 decimales.`,
        );
        return;
      }
      manualInputs.push({ inputKey: field.inputKey, value });
    }
    setLocalError(null);
    onSubmit(manualInputs);
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold">Calcular A.17</h2>
      <p className="mt-1 text-sm text-slate-500">
        Completa los antecedentes manuales. El cálculo se ejecuta de forma
        asíncrona; puedes salir de esta pantalla y volver más tarde.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {A17_MANUAL_FIELDS.map((field) => (
          <label key={field.inputKey} className="text-sm">
            <span className="font-medium text-slate-700">{field.label}</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              {field.description}
            </span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={values[field.inputKey] ?? ""}
              onChange={(event) =>
                setValues((current) => {
                  const next: Record<string, string> = {};
                  for (const key of Object.keys(current)) {
                    next[key] = current[key];
                  }
                  next[field.inputKey] = event.target.value;
                  return next;
                })
              }
            />
          </label>
        ))}
      </div>
      {localError || error ? (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {localError ?? error}
        </p>
      ) : null}
      <div className="mt-4">
        <Button type="button" disabled={pending} onClick={submit}>
          {pending ? "Iniciando…" : "Calcular"}
        </Button>
      </div>
    </section>
  );
}

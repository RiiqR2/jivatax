"use client";
import axios from "axios";
import { useEffect, useState } from "react";
import { industriesService } from "@/services/industries.service";
import type { Industry } from "@/types/industry.types";

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
export function IndustrySelector({
  value,
  initial,
  canCreate,
  onChange,
}: {
  value: string | null;
  initial?: Industry | null;
  canCreate: boolean;
  onChange: (industry: Industry | null) => void;
}) {
  const [query, setQuery] = useState(initial?.name ?? "");
  const [items, setItems] = useState<Industry[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        setItems(await industriesService.list(query, 4));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, open]);
  const exact = items.find((item) => normalize(item.name) === normalize(query));
  const create = async () => {
    if (!query.trim()) return;
    setError("");
    try {
      const industry = await industriesService.create(query);
      onChange(industry);
      setQuery(industry.name);
      setOpen(false);
    } catch (cause) {
      if (axios.isAxiosError(cause) && cause.response?.status === 409) {
        const matches = await industriesService.list(query, 4);
        const existing = matches.find(
          (item) => normalize(item.name) === normalize(query),
        );
        if (existing) {
          onChange(existing);
          setQuery(existing.name);
          setOpen(false);
          return;
        }
        setError("El rubro ya fue creado por otro usuario. Vuelve a buscarlo.");
      } else setError("No fue posible crear el rubro.");
    }
  };
  return (
    <div className="relative">
      <label className="text-sm font-medium text-slate-800" htmlFor="industry">
        Rubro
      </label>
      <input
        id="industry"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange(null);
          setOpen(true);
        }}
        className="mt-1 h-11 w-full rounded-lg border border-slate-300 px-3"
        placeholder="Buscar rubro"
        autoComplete="off"
      />
      {open && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg border bg-white p-1 shadow-lg"
          role="listbox"
        >
          {loading && <p className="p-2 text-sm text-slate-500">Buscando…</p>}
          {!loading &&
            items.map((item) => (
              <button
                type="button"
                role="option"
                aria-selected={value === item.id}
                key={item.id}
                onClick={() => {
                  onChange(item);
                  setQuery(item.name);
                  setOpen(false);
                }}
                className="block w-full rounded p-2 text-left text-sm hover:bg-slate-100"
              >
                {item.name}
              </button>
            ))}
          {!loading && !items.length && (
            <p className="p-2 text-sm text-slate-500">Sin resultados</p>
          )}
          {canCreate && query.trim() && !exact && (
            <button
              type="button"
              onClick={create}
              className="block w-full rounded p-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              + Crear rubro &quot;{query.trim()}&quot;
            </button>
          )}
        </div>
      )}
      {error && (
        <p className="mt-1 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { accountingService } from "@/services/accounting.service";
import type { AccountMappingItem } from "@/types/accounting.types";

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  suggested: "Sugerida",
  confirmed: "Confirmada",
  rejected: "Rechazada",
  unmapped: "Sin homologar",
};

export function AccountMappingPage({
  companyId,
  taxPeriodId,
}: {
  companyId: string;
  taxPeriodId: string;
}) {
  const parameters = useSearchParams();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AccountMappingItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const query = useQuery({
    queryKey: [
      "period-account-mappings",
      companyId,
      taxPeriodId,
      status,
      search,
      page,
      parameters.get("documentId"),
    ],
    queryFn: () =>
      accountingService.accountMappings(companyId, taxPeriodId, {
        status: status || undefined,
        search: search || undefined,
        page,
        limit: 25,
        documentId: parameters.get("documentId") ?? undefined,
      }),
  });
  const summary = query.data?.summary;
  const visibleSuggested =
    query.data?.items.filter(
      (item) => item.mapping.status === "pending" && item.suggestions[0],
    ) ?? [];
  const approve = async (items: AccountMappingItem[]) => {
    if (!items.length) return;
    const preview = items
      .map(
        (item) =>
          `${item.code} · ${item.periodName} → ${item.suggestions[0]?.siiAccount.code} · ${item.suggestions[0]?.siiAccount.name} (${Math.round((item.suggestions[0]?.confidence ?? 0) * 100)}%)`,
      )
      .join("\n");
    if (
      !window.confirm(`Se aprobarán ${items.length} sugerencias:\n\n${preview}`)
    )
      return;
    setApproving(true);
    try {
      await accountingService.approveAccountSuggestions(
        companyId,
        taxPeriodId,
        items.map((item) => item.companyAccountId),
      );
      setSelectedIds([]);
      await queryClient.invalidateQueries({
        queryKey: ["period-account-mappings"],
      });
    } finally {
      setApproving(false);
    }
  };
  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-8">
      <header>
        <Link
          href={`/companies/${companyId}/periods/${taxPeriodId}/documents`}
          className="text-sm text-emerald-700"
        >
          ← Volver a documentos
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">Homologación de cuentas</h1>
        {query.data?.context && (
          <p className="mt-1 text-slate-600">
            Empresa: {query.data.context.company.legalName}
            {query.data.context.company.taxId
              ? ` · RUT: ${query.data.context.company.taxId}`
              : ""}
            <br />
            Período: AT {query.data.context.taxPeriod.taxYear} · Año comercial{" "}
            {query.data.context.taxPeriod.commercialYear}
          </p>
        )}
        {query.data?.context.sourceDocument && (
          <p className="mt-1 text-sm text-slate-500">
            Balance origen: {query.data.context.sourceDocument.filename} ·
            versión {query.data.context.sourceDocument.version}
          </p>
        )}
      </header>
      <section
        aria-label="Resumen de homologación"
        className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        <Summary label="Total cuentas" value={summary?.total} />
        <Summary label="Confirmadas" value={summary?.confirmed} />
        <Summary label="Sugeridas" value={summary?.suggested} />
        <Summary label="Pendientes" value={summary?.pending} />
        <Summary label="Sin sugerencia" value={summary?.withoutSuggestion} />
        <Summary label="Confianza alta" value={summary?.highConfidence} />
        <Summary label="Confianza media" value={summary?.mediumConfidence} />
        <Summary label="Confianza baja" value={summary?.lowConfidence} />
      </section>
      <button
        type="button"
        disabled={generating}
        onClick={async () => {
          setGenerating(true);
          try {
            await accountingService.generateAccountSuggestions(
              companyId,
              taxPeriodId,
            );
            await queryClient.invalidateQueries({
              queryKey: ["period-account-mappings"],
            });
          } finally {
            setGenerating(false);
          }
        }}
        className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {generating ? "Generando sugerencias…" : "Generar sugerencias"}
      </button>
      <button
        type="button"
        disabled={
          approving ||
          !visibleSuggested.some(
            (item) => (item.suggestions[0]?.confidence ?? 0) >= 0.8,
          )
        }
        onClick={() =>
          void approve(
            visibleSuggested.filter(
              (item) => (item.suggestions[0]?.confidence ?? 0) >= 0.8,
            ),
          )
        }
        className="ml-2 mt-4 rounded-lg border border-emerald-700 px-4 py-2 text-sm text-emerald-800 disabled:opacity-50"
      >
        Aprobar sugerencias de alta confianza
      </button>
      <section className="mt-5 rounded-xl border bg-white p-5">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filtrar homologaciones"
        >
          {[
            { value: "", label: "Todas" },
            { value: "pending", label: "Pendientes" },
            { value: "suggested", label: "Sugeridas" },
            { value: "withoutSuggestion", label: "Sin sugerencia" },
            { value: "confirmed", label: "Confirmadas" },
            { value: "rejected", label: "Rechazadas" },
          ].map((filter) => (
            <button
              type="button"
              key={filter.value}
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-2 text-sm ${status === filter.value ? "bg-slate-900 text-white" : "border"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className="mt-4 block max-w-lg text-sm">
          Buscar por código, nombre interno, código o glosa SII
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="mt-1 w-full rounded-lg border p-2"
            placeholder="Buscar cuentas"
          />
        </label>
      </section>
      <section
        className="mt-5 overflow-hidden rounded-xl border bg-white"
        aria-labelledby="mapping-table"
      >
        <h2 id="mapping-table" className="border-b p-5 font-semibold">
          Cuentas detectadas en el Balance
        </h2>
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-3 border-b bg-emerald-50 p-3 text-sm">
            <strong>{selectedIds.length} seleccionadas</strong>
            <button
              type="button"
              disabled={approving}
              onClick={() =>
                void approve(
                  visibleSuggested.filter((item) =>
                    selectedIds.includes(item.companyAccountId),
                  ),
                )
              }
              className="rounded bg-emerald-700 px-3 py-2 text-white"
            >
              Aprobar seleccionadas
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="underline"
            >
              Limpiar selección
            </button>
          </div>
        )}
        {query.isLoading ? (
          <p className="p-6">Cargando cuentas…</p>
        ) : query.isError ? (
          <div className="p-8 text-center" role="alert">
            <h3 className="font-semibold">
              No fue posible cargar la homologación
            </h3>
            <p className="mt-2 text-sm text-slate-600">Intenta nuevamente.</p>
          </div>
        ) : query.data?.items.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="font-semibold">
              {query.data.summary.total === 0
                ? "No existen cuentas para homologar"
                : status === "suggested"
                  ? "No existen sugerencias con los filtros seleccionados."
                  : "No existen cuentas con los filtros seleccionados."}
            </h3>
            {query.data.summary.total === 0 && (
              <p className="mt-2 text-sm text-slate-600">
                Carga y procesa un Balance válido con filas para generar las
                cuentas del período.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Cuentas internas y su homologación SII
              </caption>
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas las sugerencias visibles"
                      checked={
                        visibleSuggested.length > 0 &&
                        visibleSuggested.every((item) =>
                          selectedIds.includes(item.companyAccountId),
                        )
                      }
                      onChange={(event) =>
                        setSelectedIds(
                          event.target.checked
                            ? visibleSuggested.map(
                                (item) => item.companyAccountId,
                              )
                            : [],
                        )
                      }
                    />
                  </th>
                  {[
                    "Código interno",
                    "Nombre de cuenta",
                    "Cuenta SII",
                    "Estado",
                    "Confianza",
                    "Última aparición",
                    "Acciones",
                  ].map((label) => (
                    <th key={label} scope="col" className="px-3 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data?.items.map((item) => (
                  <tr key={item.companyAccountId} className="border-t">
                    <td className="px-3 py-3">
                      {item.mapping.status === "pending" &&
                        item.suggestions[0] && (
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar ${item.periodName}`}
                            checked={selectedIds.includes(
                              item.companyAccountId,
                            )}
                            onChange={(event) =>
                              setSelectedIds((current) =>
                                event.target.checked
                                  ? [...current, item.companyAccountId]
                                  : current.filter(
                                      (id) => id !== item.companyAccountId,
                                    ),
                              )
                            }
                          />
                        )}
                    </td>
                    <td className="px-3 py-3 font-mono">{item.code}</td>
                    <td className="px-3 py-3">
                      {item.periodName}
                      {item.nameChanged && (
                        <span className="mt-1 block text-xs text-amber-700">
                          Nombre modificado · Canónico: {item.canonicalName}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {item.mapping.siiAccount
                        ? `${item.mapping.siiAccount.code} · ${item.mapping.siiAccount.name}`
                        : item.suggestions[0]
                          ? `${item.suggestions[0].siiAccount.code} · ${item.suggestions[0].siiAccount.name} (sugerida)`
                          : "Sin sugerencias"}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1">
                        {statusLabels[item.mapping.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {item.mapping.confidence === null
                        ? item.suggestions[0]
                          ? `${Math.round(item.suggestions[0].confidence * 100)}%`
                          : "—"
                        : `${Math.round(item.mapping.confidence * 100)}%`}
                    </td>
                    <td className="px-3 py-3">{item.lastSeenTaxYear ?? "—"}</td>
                    <td className="px-3 py-3">
                      {item.mapping.status === "pending" &&
                        item.suggestions[0] && (
                          <button
                            type="button"
                            disabled={approving}
                            onClick={() => void approve([item])}
                            className="mr-2 rounded-lg bg-emerald-700 px-3 py-2 text-white"
                          >
                            Aprobar
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => setSelected(item)}
                        className="rounded-lg border px-3 py-2"
                      >
                        Revisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {(query.data?.total ?? 0) > 25 && (
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage((current) => current - 1)}
            className="rounded border px-3 py-2 disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="p-2 text-sm">Página {page}</span>
          <button
            type="button"
            disabled={page * 25 >= (query.data?.total ?? 0)}
            onClick={() => setPage((current) => current + 1)}
            className="rounded border px-3 py-2 disabled:opacity-50"
          >
            Siguiente
          </button>
        </div>
      )}
      {selected && (
        <MappingDialog
          companyId={companyId}
          item={selected}
          close={() => setSelected(null)}
          saved={async () => {
            setSelected(null);
            await queryClient.invalidateQueries({
              queryKey: ["period-account-mappings"],
            });
          }}
        />
      )}
    </main>
  );
}

function Summary({
  label,
  value,
}: {
  label: string;
  value: number | undefined;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value ?? "—"}</p>
    </div>
  );
}

function MappingDialog({
  companyId,
  item,
  close,
  saved,
}: {
  companyId: string;
  item: AccountMappingItem;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [selectedSii, setSelectedSii] = useState(
    item.mapping.siiAccount?.id ?? item.suggestions[0]?.siiAccount.id ?? "",
  );
  const [confirmChange, setConfirmChange] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const sii = useQuery({
    queryKey: ["sii-accounts", search],
    queryFn: () => accountingService.siiAccounts(search),
    enabled: search.length >= 2,
  });
  const history = useQuery({
    queryKey: ["mapping-history", companyId, item.companyAccountId],
    queryFn: () =>
      accountingService.mappingHistory(companyId, item.companyAccountId),
    enabled: historyOpen,
  });
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const confirm = async () => {
    if (!selectedSii) return;
    if (
      item.mapping.status === "confirmed" &&
      selectedSii !== item.mapping.siiAccount?.id &&
      !confirmChange
    ) {
      setConfirmChange(true);
      return;
    }
    await accountingService.updateAccountMapping(
      companyId,
      item.companyAccountId,
      "confirm",
      selectedSii,
    );
    await saved();
  };
  return (
    <dialog
      ref={ref}
      onClose={close}
      aria-labelledby="mapping-title"
      className="m-auto w-full max-w-2xl rounded-xl p-0 backdrop:bg-slate-900/40"
    >
      <div className="p-6">
        <h2 id="mapping-title" className="text-xl font-semibold">
          Revisar cuenta {item.code}
        </h2>
        <p className="mt-1 text-slate-600">
          {item.canonicalName} · La selección no se guarda automáticamente.
        </p>
        {item.suggestions[0] ? (
          <section className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <h3 className="font-semibold">Sugerencia</h3>
            <p>
              {item.suggestions[0].siiAccount.code} ·{" "}
              {item.suggestions[0].siiAccount.name}
            </p>
            <p>
              Confianza: {Math.round(item.suggestions[0].confidence * 100)}% ·
              Puntaje: {item.suggestions[0].score}
            </p>
            <details className="mt-2">
              <summary className="cursor-pointer underline">
                Ver explicación
              </summary>
              <ul className="mt-1 list-disc pl-5">
                {item.suggestions[0].reasons.map((reason, index) => (
                  <li key={`${reason.signal}-${index}`}>
                    {reason.description} ({reason.points > 0 ? "+" : ""}
                    {reason.points})
                  </li>
                ))}
              </ul>
            </details>
          </section>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Sin sugerencias</p>
        )}
        <label className="mt-5 block text-sm">
          Buscar cuenta SII
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-1 w-full rounded-lg border p-2"
            placeholder="Código o glosa SII"
          />
        </label>
        {sii.data && (
          <fieldset className="mt-3 max-h-48 overflow-y-auto rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">
              Resultados del catálogo SII
            </legend>
            {sii.data.map((account) => (
              <label
                key={account.id}
                className="flex gap-2 border-b py-2 text-sm"
              >
                <input
                  type="radio"
                  name="sii-account"
                  checked={selectedSii === account.id}
                  onChange={() => setSelectedSii(account.id)}
                />
                {account.code} · {account.name}
              </label>
            ))}
          </fieldset>
        )}
        {confirmChange && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
          >
            Esta cuenta ya está confirmada. Presiona nuevamente “Confirmar
            homologación” para registrar el cambio y conservarlo en el
            historial.
          </p>
        )}
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          className="mt-4 text-sm text-emerald-700 underline"
        >
          {historyOpen ? "Ocultar historial" : "Ver historial"}
        </button>
        {historyOpen && (
          <ul className="mt-2 max-h-32 overflow-y-auto rounded border p-3 text-sm">
            {history.data?.items.length ? (
              history.data.items.map((entry, index) => (
                <li key={String(entry.id ?? index)} className="border-b py-2">
                  {String(entry.changedAt)} ·{" "}
                  {String(entry.previousStatus ?? "—")} →{" "}
                  {String(entry.newStatus)} ·{" "}
                  {String(entry.reason ?? "Sin motivo")}
                </li>
              ))
            ) : (
              <li>Sin cambios anteriores.</li>
            )}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-lg border px-4 py-2"
          >
            Cancelar
          </button>
          {item.mapping.status === "pending" && item.suggestions[0] && (
            <button
              type="button"
              onClick={async () => {
                await accountingService.updateAccountMapping(
                  companyId,
                  item.companyAccountId,
                  "reject",
                );
                await saved();
              }}
              className="rounded-lg border border-red-300 px-4 py-2 text-red-700"
            >
              Rechazar sugerencia
            </button>
          )}
          <button
            type="button"
            disabled={!selectedSii}
            onClick={() => void confirm()}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {item.suggestions[0]?.siiAccount.id === selectedSii
              ? "Aceptar sugerencia"
              : "Confirmar homologación"}
          </button>
        </div>
      </div>
    </dialog>
  );
}

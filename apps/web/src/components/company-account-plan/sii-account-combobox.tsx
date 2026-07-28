"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import type { SiiAccount } from "@/types/company-account-plan.types";

export function SiiAccountCombobox({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (account: SiiAccount) => void;
}) {
  const [search, setSearch] = useState("");
  const accounts = useQuery({
    queryKey: ["sii-account-plan", "accounts", search],
    queryFn: async () => {
      const response = await api.get<{
        items: SiiAccount[];
      }>("/sii/account-plan/accounts", {
        params: {
          search,
          page: 1,
          pageSize: 20,
        },
      });
      return response.data.items;
    },
    enabled: search.trim().length >= 2,
  });
  return (
    <div className="space-y-2">
      <input
        className="w-full rounded-lg border px-3 py-2 text-sm"
        placeholder="Buscar cuenta SII por código o nombre"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {accounts.data && (
        <select
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={value ?? ""}
          size={Math.min(accounts.data.length + 1, 6)}
          onChange={(event) => {
            const account = accounts.data.find(
              (item) => item.id === event.target.value,
            );
            if (account) {
              onChange(account);
            }
          }}
        >
          <option value="">Selecciona una cuenta</option>
          {accounts.data.map((account) => (
            <option key={account.id} value={account.id}>
              {account.code} · {account.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

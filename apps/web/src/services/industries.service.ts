import { api } from "@/lib/api";
import type { Industry } from "@/types/industry.types";
export const industriesService = {
  async list(q = "", limit = 4) {
    return (await api.get<Industry[]>("/industries", { params: { q, limit } }))
      .data;
  },
  async create(name: string) {
    return (await api.post<Industry>("/industries", { name })).data;
  },
};

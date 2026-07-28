"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminUsersService } from "@/services/admin-users.service";
import type {
  AdminUserFilters,
  AdminUserInput,
} from "@/types/admin-user.types";

export const adminUserKeys = {
  all: ["admin-users"] as const,
  lists: () => [...adminUserKeys.all, "list"] as const,
  list: (filters: AdminUserFilters) =>
    [...adminUserKeys.lists(), filters] as const,
  details: () => [...adminUserKeys.all, "detail"] as const,
  detail: (userId: string) => [...adminUserKeys.details(), userId] as const,
};

export function useAdminUsers(filters: AdminUserFilters) {
  return useQuery({
    queryKey: adminUserKeys.list(filters),
    queryFn: () => adminUsersService.list(filters),
  });
}

export function useAdminUser(userId: string) {
  return useQuery({
    queryKey: adminUserKeys.detail(userId),
    queryFn: () => adminUsersService.get(userId),
    enabled: Boolean(userId),
  });
}

export function useCreateAdminUser() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminUserInput) => adminUsersService.create(input),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: adminUserKeys.lists(),
      });
    },
  });
}

export function useUpdateAdminUser(userId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminUserInput) =>
      adminUsersService.update(userId, input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: adminUserKeys.lists(),
        }),
        client.invalidateQueries({
          queryKey: adminUserKeys.detail(userId),
        }),
      ]);
    },
  });
}

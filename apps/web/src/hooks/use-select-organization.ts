"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import { sessionKey } from "./use-session";
export function useSelectOrganization() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: authService.selectOrganization,
    onSuccess: (session) => client.setQueryData(sessionKey, session),
  });
}

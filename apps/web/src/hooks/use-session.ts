"use client";
import { useQuery } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
export const sessionKey = ["auth", "me"] as const;
export function useSession() {
  const query = useQuery({
    queryKey: sessionKey,
    queryFn: authService.me,
    staleTime: 60_000,
    retry: false,
  });
  return {
    ...query,
    status: query.isPending
      ? ("loading" as const)
      : query.isSuccess
        ? ("authenticated" as const)
        : ("unauthenticated" as const),
  };
}

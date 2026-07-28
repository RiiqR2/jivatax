"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { configureAuthFailureHandler } from "@/lib/api";
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const client = useQueryClient();
  const router = useRouter();
  useEffect(
    () =>
      configureAuthFailureHandler(() => {
        client.clear();
        router.replace("/login");
      }),
    [client, router],
  );
  return children;
}

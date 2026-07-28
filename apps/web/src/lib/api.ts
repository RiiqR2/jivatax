import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { env } from "@/lib/env";
declare module "axios" {
  export interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}
export const api = axios.create({
  baseURL: env.NEXT_PUBLIC_API_URL,
  headers: { Accept: "application/json" },
  withCredentials: true,
});
let refreshPromise: Promise<void> | null = null;
let logoutInProgress = false;
let authFailureHandler: (() => void) | undefined;
export function configureAuthFailureHandler(handler: () => void): () => void {
  authFailureHandler = handler;
  return () => {
    if (authFailureHandler === handler) authFailureHandler = undefined;
  };
}
export function beginLogout(): void {
  logoutInProgress = true;
}
export function restoreAuthenticatedRequests(): void {
  logoutInProgress = false;
}
function authPath(config?: InternalAxiosRequestConfig): boolean {
  const url = config?.url ?? "";
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/logout")
  );
}
api.interceptors.request.use((config) => {
  if (logoutInProgress && !authPath(config))
    return Promise.reject(new axios.Cancel("Cierre de sesión en curso."));
  return config;
});
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config;
    if (
      logoutInProgress ||
      error.response?.status !== 401 ||
      !config ||
      config._retry ||
      authPath(config)
    )
      return Promise.reject(error);
    config._retry = true;
    if (!refreshPromise)
      refreshPromise = api
        .post("/auth/refresh")
        .then(() => undefined)
        .finally(() => {
          refreshPromise = null;
        });
    try {
      await refreshPromise;
      return api.request(config);
    } catch (refreshError) {
      authFailureHandler?.();
      return Promise.reject(refreshError);
    }
  },
);

import { registerAs } from "@nestjs/config";
import type { TlsOptions } from "tls";

export function isDatabaseSslEnabled(): boolean {
  return process.env.DATABASE_SSL === "true";
}

/** TiDB Cloud (and similar hosted MySQL) require TLS on public endpoints. */
export function getDatabaseSslOptions(): TlsOptions | undefined {
  if (!isDatabaseSslEnabled()) {
    return undefined;
  }

  return {
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
  };
}

export const databaseConfig = registerAs("database", () => ({
  host: process.env.DATABASE_HOST ?? "localhost",
  port: Number(process.env.DATABASE_PORT ?? 3306),
  name: process.env.DATABASE_NAME ?? "jivatax",
  user: process.env.DATABASE_USER ?? "jivatax",
  password: process.env.DATABASE_PASSWORD ?? "jivatax",
  logging: process.env.DATABASE_LOGGING === "true",
  ssl: isDatabaseSslEnabled(),
}));

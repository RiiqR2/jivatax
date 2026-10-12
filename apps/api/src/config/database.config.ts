import { registerAs } from "@nestjs/config";
import type { TlsOptions } from "tls";

/**
 * TiDB Cloud public endpoints require TLS.
 * - DATABASE_SSL=true|false forces the setting
 * - otherwise SSL is enabled automatically for *.tidbcloud.com hosts
 */
export function isDatabaseSslEnabled(
  host = process.env.DATABASE_HOST ?? "localhost",
): boolean {
  if (process.env.DATABASE_SSL === "true") {
    return true;
  }
  if (process.env.DATABASE_SSL === "false") {
    return false;
  }
  return host.includes("tidbcloud.com");
}

export function getDatabaseSslOptions(
  host = process.env.DATABASE_HOST ?? "localhost",
): TlsOptions | undefined {
  if (!isDatabaseSslEnabled(host)) {
    return undefined;
  }

  return {
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
  };
}

export const databaseConfig = registerAs("database", () => {
  const host = process.env.DATABASE_HOST ?? "localhost";
  return {
    host,
    port: Number(process.env.DATABASE_PORT ?? 3306),
    name: process.env.DATABASE_NAME ?? "jivatax",
    user: process.env.DATABASE_USER ?? "jivatax",
    password: process.env.DATABASE_PASSWORD ?? "jivatax",
    logging: process.env.DATABASE_LOGGING === "true",
    ssl: isDatabaseSslEnabled(host),
  };
});

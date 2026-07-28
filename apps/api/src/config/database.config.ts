import { registerAs } from "@nestjs/config";

export const databaseConfig = registerAs("database", () => ({
  host: process.env.DATABASE_HOST ?? "localhost",
  port: Number(process.env.DATABASE_PORT ?? 3306),
  name: process.env.DATABASE_NAME ?? "jivatax",
  user: process.env.DATABASE_USER ?? "jivatax",
  password: process.env.DATABASE_PASSWORD ?? "jivatax",
  logging: process.env.DATABASE_LOGGING === "true",
}));

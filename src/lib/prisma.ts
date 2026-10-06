import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../app/config/env.js";
import { PrismaClient } from "../generated/prisma/client";

const normalizeDatabaseUrl = (connectionString: string) => {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode");

  // pg 8 treats these aliases as verify-full and will change their meaning in pg 9.
  // Make the existing secure behavior explicit and remove the migration warning.
  if (
    sslMode === "prefer" ||
    sslMode === "require" ||
    sslMode === "verify-ca"
  ) {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
};

const adapter = new PrismaPg({
  connectionString: normalizeDatabaseUrl(env.DATABASE_URL),
  max: env.DB_POOL_MAX,
  connectionTimeoutMillis: env.DB_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
});

export const prisma = new PrismaClient({
  adapter,
  transactionOptions: {
    maxWait: env.DB_TRANSACTION_MAX_WAIT_MS,
    timeout: env.DB_TRANSACTION_TIMEOUT_MS,
  },
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../app/config/env.js";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
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

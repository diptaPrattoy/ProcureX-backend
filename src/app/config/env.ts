import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(5000),
  API_PREFIX: z.string().trim().startsWith("/").default("/api/v1"),
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().trim().min(1, "DIRECT_URL is required"),
  CORS_ORIGINS: z.string().trim().default("http://localhost:3000"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${details}`);
}

const corsOrigins = parsedEnv.data.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const env = {
  ...parsedEnv.data,
  CORS_ORIGINS: corsOrigins,
} as const;

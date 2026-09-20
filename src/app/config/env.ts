import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(5000),
  API_PREFIX: z.string().trim().startsWith("/").default("/api/v1"),
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().trim().min(1, "DIRECT_URL is required"),
  CORS_ORIGINS: z.string().trim().default("http://localhost:3000"),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET must be at least 32 characters")
    .refine((value) => !value.startsWith("CHANGE_ME"), {
      message: "JWT_ACCESS_SECRET must be replaced with a real random secret",
    }),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().max(1440).default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),
  JWT_ISSUER: z.string().trim().min(1).default("procurax-api"),
  JWT_AUDIENCE: z.string().trim().min(1).default("procurax-client"),
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

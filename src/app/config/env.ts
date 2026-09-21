import "dotenv/config";
import { z } from "zod";

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined));

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(5000),
    API_PREFIX: z.string().trim().startsWith("/").default("/api/v1"),
    DATABASE_URL: z.string().trim().min(1, "DATABASE_URL is required"),
    DIRECT_URL: z.string().trim().min(1, "DIRECT_URL is required"),
    DB_POOL_MAX: z.coerce.number().int().positive().max(20).default(5),
    DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().max(60000).default(10000),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().max(600000).default(60000),
    DB_TRANSACTION_MAX_WAIT_MS: z.coerce.number().int().positive().max(60000).default(10000),
    DB_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().positive().max(120000).default(15000),
    CORS_ORIGINS: z.string().trim().default("http://localhost:3000"),
    CLIENT_APP_URL: z.url().default("http://localhost:3000"),
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
    GOOGLE_CLIENT_ID: optionalTrimmedString,
    EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().max(168).default(24),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().max(180).default(30),
    EMAIL_DELIVERY_MODE: z.enum(["console", "smtp"]).default("console"),
    MAIL_FROM_NAME: z.string().trim().min(1).default("ProcuraX"),
    MAIL_FROM_EMAIL: z.email().default("no-reply@procurax.local"),
    SMTP_HOST: optionalTrimmedString,
    SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SMTP_USER: optionalTrimmedString,
    SMTP_PASS: optionalTrimmedString,
    STRIPE_SECRET_KEY: optionalTrimmedString,
    STRIPE_WEBHOOK_SECRET: optionalTrimmedString,
    STRIPE_SUCCESS_URL: z.url().default("http://localhost:3000/payments/success?session_id={CHECKOUT_SESSION_ID}"),
    STRIPE_CANCEL_URL: z.url().default("http://localhost:3000/payments/cancel"),
    CACHE_ENABLED: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    UPSTASH_REDIS_REST_URL: optionalTrimmedString,
    UPSTASH_REDIS_REST_TOKEN: optionalTrimmedString,
    CACHE_CATEGORY_TTL_SECONDS: z.coerce.number().int().positive().max(86400).default(600),
    CACHE_SUPPLIER_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(120),
    CACHE_ANALYTICS_TTL_SECONDS: z.coerce.number().int().positive().max(600).default(30),
  })
  .superRefine((value, ctx) => {
    if (value.EMAIL_DELIVERY_MODE === "smtp") {
      for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required when EMAIL_DELIVERY_MODE=smtp`,
          });
        }
      }
    }

    const hasRedisUrl = Boolean(value.UPSTASH_REDIS_REST_URL);
    const hasRedisToken = Boolean(value.UPSTASH_REDIS_REST_TOKEN);
    if (hasRedisUrl !== hasRedisToken) {
      ctx.addIssue({
        code: "custom",
        path: [hasRedisUrl ? "UPSTASH_REDIS_REST_TOKEN" : "UPSTASH_REDIS_REST_URL"],
        message: "Both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be provided together",
      });
    }

    if (value.NODE_ENV === "production") {
      for (const key of ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const) {
        if (!value[key]) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `${key} is required in production`,
          });
        }
      }
    }
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

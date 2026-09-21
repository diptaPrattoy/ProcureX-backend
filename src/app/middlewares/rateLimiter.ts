import type { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { Ratelimit } from "@upstash/ratelimit";
import { env } from "../config/env.js";
import { rateLimitRedis } from "../../lib/redis.js";
import { buildRateLimitIdentifier } from "./rateLimit.domain.js";

const baseMessage = {
  success: false,
  message: "Too many requests. Please try again later.",
  errors: [],
};

const authMessage = {
  success: false,
  message: "Too many authentication attempts. Please try again later.",
  errors: [],
};

const memoryGlobalLimiter = rateLimit({
  standardHeaders: "draft-8",
  legacyHeaders: false,
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  limit: env.RATE_LIMIT_GLOBAL_LIMIT,
  message: baseMessage,
});

const memoryAuthLimiter = rateLimit({
  standardHeaders: "draft-8",
  legacyHeaders: false,
  windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_LIMIT,
  message: authMessage,
});

const distributedGlobalLimiter = rateLimitRedis
  ? new Ratelimit({
      redis: rateLimitRedis,
      limiter: Ratelimit.slidingWindow(
        env.RATE_LIMIT_GLOBAL_LIMIT,
        `${env.RATE_LIMIT_WINDOW_MINUTES} m` as `${number} m`,
      ),
      prefix: "procurax:ratelimit:global",
      analytics: false,
    })
  : null;

const distributedAuthLimiter = rateLimitRedis
  ? new Ratelimit({
      redis: rateLimitRedis,
      limiter: Ratelimit.slidingWindow(
        env.RATE_LIMIT_AUTH_LIMIT,
        `${env.RATE_LIMIT_WINDOW_MINUTES} m` as `${number} m`,
      ),
      prefix: "procurax:ratelimit:auth",
      analytics: false,
    })
  : null;

let hasLoggedDistributedFailure = false;

const setHeaders = (
  res: Response,
  result: { limit: number; remaining: number; reset: number },
): void => {
  res.setHeader("RateLimit-Limit", String(result.limit));
  res.setHeader("RateLimit-Remaining", String(Math.max(0, result.remaining)));
  res.setHeader("RateLimit-Reset", String(Math.max(0, Math.ceil((result.reset - Date.now()) / 1000))));
};

const distributedMiddleware = (
  scope: "global" | "auth",
  limiter: Ratelimit,
  message: typeof baseMessage,
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!env.RATE_LIMIT_ENABLED || req.method === "OPTIONS") {
      next();
      return;
    }

    try {
      const identifier = buildRateLimitIdentifier(scope, req.ip ?? req.socket.remoteAddress);
      const result = await limiter.limit(identifier);
      setHeaders(res, result);

      if (!result.success) {
        res.status(429).json(message);
        return;
      }

      next();
    } catch (error) {
      // Rate limiting should not become a single point of failure. In production,
      // Redis is required at startup, but a transient Upstash outage fails open.
      if (!hasLoggedDistributedFailure && env.NODE_ENV !== "test") {
        hasLoggedDistributedFailure = true;
        const details = error instanceof Error ? error.message : String(error);
        console.warn(`[ratelimit] Distributed limiter unavailable; failing open. ${details}`);
      }
      next();
    }
  };
};

export const globalRateLimiter = distributedGlobalLimiter
  ? distributedMiddleware("global", distributedGlobalLimiter, baseMessage)
  : env.RATE_LIMIT_ENABLED
    ? memoryGlobalLimiter
    : (_req: Request, _res: Response, next: NextFunction) => next();

export const authSensitiveRateLimiter = distributedAuthLimiter
  ? distributedMiddleware("auth", distributedAuthLimiter, authMessage)
  : env.RATE_LIMIT_ENABLED
    ? memoryAuthLimiter
    : (_req: Request, _res: Response, next: NextFunction) => next();

import { Redis } from "@upstash/redis";
import { env } from "../app/config/env.js";

const configured = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

const redisConfig = configured
  ? {
      url: env.UPSTASH_REDIS_REST_URL as string,
      token: env.UPSTASH_REDIS_REST_TOKEN as string,
    }
  : null;

// Cache values are explicitly JSON.stringify'd by CacheService, so disable
// automatic deserialization for predictable cache payload handling.
export const redis = redisConfig
  ? new Redis({
      ...redisConfig,
      enableAutoPipelining: true,
      automaticDeserialization: false,
    })
  : null;

// The rate-limit SDK manages its own Redis data structures. Keep a standard
// client for it rather than sharing cache serialization behavior.
export const rateLimitRedis = redisConfig
  ? new Redis({
      ...redisConfig,
      enableAutoPipelining: true,
    })
  : null;

export const redisEnabled = Boolean(redis && env.CACHE_ENABLED);

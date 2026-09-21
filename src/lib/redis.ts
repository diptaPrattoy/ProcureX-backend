import { Redis } from "@upstash/redis";
import { env } from "../app/config/env.js";

const configured = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

export const redis = configured
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL as string,
      token: env.UPSTASH_REDIS_REST_TOKEN as string,
      enableAutoPipelining: true,
      automaticDeserialization: false,
    })
  : null;

export const redisEnabled = Boolean(redis && env.CACHE_ENABLED);

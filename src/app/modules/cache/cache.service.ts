import { env } from "../../config/env.js";
import { redis, redisEnabled } from "../../../lib/redis.js";
import { buildCacheKey } from "./cache.domain.js";

let hasLoggedRedisFailure = false;

const logRedisFailureOnce = (error: unknown) => {
  if (hasLoggedRedisFailure || env.NODE_ENV === "test") {
    return;
  }

  hasLoggedRedisFailure = true;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[cache] Redis unavailable; falling back to PostgreSQL. ${message}`);
};

const get = async <T>(key: string): Promise<T | null> => {
  if (!redisEnabled || !redis) {
    return null;
  }

  try {
    const raw = await redis.get<string>(key);
    if (raw === null) {
      return null;
    }

    return JSON.parse(raw) as T;
  } catch (error) {
    logRedisFailureOnce(error);
    return null;
  }
};

const set = async <T>(key: string, value: T, ttlSeconds: number): Promise<void> => {
  if (!redisEnabled || !redis) {
    return;
  }

  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch (error) {
    logRedisFailureOnce(error);
  }
};

const remember = async <T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> => {
  const cached = await get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const fresh = await loader();
  await set(key, fresh, ttlSeconds);
  return fresh;
};

const namespaceVersionKey = (namespace: string) => buildCacheKey(`version:${namespace}`);

const getNamespaceVersion = async (namespace: string): Promise<number> => {
  if (!redisEnabled || !redis) {
    return 1;
  }

  try {
    const raw = await redis.get<string>(namespaceVersionKey(namespace));
    const version = raw === null ? Number.NaN : Number(raw);
    return Number.isInteger(version) && version > 0 ? version : 1;
  } catch (error) {
    logRedisFailureOnce(error);
    return 1;
  }
};

const bumpNamespace = async (namespace: string): Promise<void> => {
  if (!redisEnabled || !redis) {
    return;
  }

  const key = namespaceVersionKey(namespace);

  try {
    const current = await redis.get<string>(key);
    if (current === null) {
      // Cached reads use version 1 before the version key exists. Start at 2 so
      // the first invalidation really invalidates any existing v1 entries.
      await redis.set(key, "2");
      return;
    }

    await redis.incr(key);
  } catch (error) {
    logRedisFailureOnce(error);
  }
};

const rememberVersioned = async <T>(
  namespace: string,
  payload: unknown,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> => {
  const version = await getNamespaceVersion(namespace);
  return remember(buildCacheKey(`${namespace}:v${version}`, payload), ttlSeconds, loader);
};

const status = () => ({
  enabled: redisEnabled,
  provider: redisEnabled ? "upstash" : "disabled",
});

export const CacheService = {
  get,
  set,
  remember,
  rememberVersioned,
  bumpNamespace,
  status,
};

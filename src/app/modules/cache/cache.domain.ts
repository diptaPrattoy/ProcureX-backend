const normalize = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalize);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalize(nested)]),
    );
  }

  return value;
};

export const stableSerialize = (value: unknown) => JSON.stringify(normalize(value));

export const buildCacheKey = (namespace: string, payload?: unknown) => {
  const cleanNamespace = namespace.trim().replace(/\s+/g, "-").toLowerCase();
  if (payload === undefined) {
    return `procurax:${cleanNamespace}`;
  }

  return `procurax:${cleanNamespace}:${stableSerialize(payload)}`;
};

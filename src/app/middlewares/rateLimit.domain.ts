export const normalizeClientIp = (value: string | undefined | null): string => {
  const ip = (value ?? "unknown").trim();
  if (!ip) {
    return "unknown";
  }

  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
};

export const buildRateLimitIdentifier = (
  scope: string,
  ip: string | undefined | null,
): string => `${scope}:${normalizeClientIp(ip)}`;

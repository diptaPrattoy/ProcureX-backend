import { createHash, randomBytes } from "node:crypto";
import type { AuthTokenType, Prisma } from "../../generated/prisma/client";
import { env } from "../config/env.js";

export const generateOneTimeToken = (): string => randomBytes(32).toString("base64url");

export const hashOneTimeToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const getExpiry = (type: AuthTokenType): Date => {
  const expiresAt = new Date();

  if (type === "EMAIL_VERIFICATION") {
    expiresAt.setUTCHours(expiresAt.getUTCHours() + env.EMAIL_VERIFICATION_TTL_HOURS);
    return expiresAt;
  }

  expiresAt.setUTCMinutes(expiresAt.getUTCMinutes() + env.PASSWORD_RESET_TTL_MINUTES);
  return expiresAt;
};

type AuthTokenDbClient = Pick<Prisma.TransactionClient, "authToken">;

export const issueOneTimeToken = async (
  db: AuthTokenDbClient,
  userId: string,
  type: AuthTokenType,
) => {
  const rawToken = generateOneTimeToken();

  await db.authToken.deleteMany({
    where: {
      userId,
      type,
      consumedAt: null,
    },
  });

  await db.authToken.create({
    data: {
      userId,
      type,
      tokenHash: hashOneTimeToken(rawToken),
      expiresAt: getExpiry(type),
    },
  });

  return rawToken;
};

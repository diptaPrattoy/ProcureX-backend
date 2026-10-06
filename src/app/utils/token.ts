import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

const jwtSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

const accessTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.email(),
  role: z.enum(["BUYER", "SUPPLIER", "ADMIN"]),
});

export type AccessTokenPrincipal = z.infer<typeof accessTokenPayloadSchema>;

export const signAccessToken = async (
  principal: AccessTokenPrincipal,
): Promise<string> => {
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + env.JWT_ACCESS_TTL_MINUTES * 60;

  return new SignJWT({
    email: principal.email,
    role: principal.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(principal.sub)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(jwtSecret);
};

export const verifyAccessToken = async (
  token: string,
): Promise<AccessTokenPrincipal> => {
  try {
    const { payload } = await jwtVerify(token, jwtSecret, {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });

    return accessTokenPayloadSchema.parse({
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
    });
  } catch {
    throw new AppError(401, "Invalid or expired access token");
  }
};

export const generateRefreshToken = (): string => {
  return randomBytes(48).toString("base64url");
};

export const hashRefreshToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

export const getRefreshTokenExpiry = (): Date => {
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + env.REFRESH_TOKEN_TTL_DAYS);
  return expiresAt;
};

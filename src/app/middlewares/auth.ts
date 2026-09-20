import type { RequestHandler } from "express";
import type { UserRole } from "../../generated/prisma/client";
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../errors/AppError.js";
import { verifyAccessToken } from "../utils/token.js";
import { catchAsync } from "../utils/catchAsync.js";

const readBearerToken = (authorizationHeader?: string): string => {
  if (!authorizationHeader) {
    throw new AppError(401, "Authentication required");
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new AppError(401, "Authorization header must use Bearer token");
  }

  return token;
};

export const requireAuth: RequestHandler = catchAsync(async (req, _res, next) => {
  const token = readBearerToken(req.headers.authorization);
  const principal = await verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: { id: principal.sub },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      deletedAt: true,
    },
  });

  if (!user || user.deletedAt) {
    throw new AppError(401, "Authentication required");
  }

  if (user.status !== "ACTIVE") {
    throw new AppError(403, "This account is not active");
  }

  if (user.email !== principal.email || user.role !== principal.role) {
    throw new AppError(401, "Access token no longer matches this account");
  }

  req.authUser = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  next();
});

export const requireRoles = (...roles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.authUser) {
      next(new AppError(401, "Authentication required"));
      return;
    }

    if (!roles.includes(req.authUser.role)) {
      next(new AppError(403, "You do not have permission to perform this action"));
      return;
    }

    next();
  };
};

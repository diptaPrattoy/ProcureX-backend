import type { Prisma, UserRole } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import {
  generateRefreshToken,
  getRefreshTokenExpiry,
  hashRefreshToken,
  signAccessToken,
} from "../../utils/token.js";
import { AuditService, type AuditContext } from "../audit/audit.service.js";
import type {
  LoginInput,
  RefreshTokenInput,
  RegisterBuyerInput,
  RegisterSupplierInput,
} from "./auth.validation.js";

const userWithProfiles = {
  buyerProfile: true,
  supplierProfile: true,
} satisfies Prisma.UserInclude;

type UserWithProfiles = Prisma.UserGetPayload<{ include: typeof userWithProfiles }>;

const toPublicUser = (user: UserWithProfiles) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  status: user.status,
  firstName: user.firstName,
  lastName: user.lastName,
  phone: user.phone,
  avatarUrl: user.avatarUrl,
  emailVerifiedAt: user.emailVerifiedAt,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
  buyerProfile: user.buyerProfile,
  supplierProfile: user.supplierProfile,
});

const createRefreshTokenRecord = async (
  db: Prisma.TransactionClient,
  userId: string,
  rawRefreshToken: string,
) => {
  return db.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(rawRefreshToken),
      expiresAt: getRefreshTokenExpiry(),
    },
  });
};

const buildSession = async (user: UserWithProfiles, refreshToken: string) => {
  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: toPublicUser(user),
    tokens: {
      tokenType: "Bearer" as const,
      accessToken,
      refreshToken,
    },
  };
};

const ensurePublicRegistrationEmailAvailable = async (
  db: Prisma.TransactionClient,
  email: string,
) => {
  const existingUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError(409, "An account with this email already exists");
  }
};

const registerBuyer = async (input: RegisterBuyerInput, context: AuditContext) => {
  const passwordHash = await hashPassword(input.password);
  const refreshToken = generateRefreshToken();

  const user = await prisma.$transaction(async (tx) => {
    await ensurePublicRegistrationEmailAvailable(tx, input.email);

    const createdUser = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: "BUYER",
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        buyerProfile: {
          create: {
            companyName: input.companyName,
            legalName: input.legalName,
            city: input.city,
            country: input.country,
          },
        },
      },
      include: userWithProfiles,
    });

    await createRefreshTokenRecord(tx, createdUser.id, refreshToken);

    await AuditService.create(tx, {
      actorId: createdUser.id,
      action: "BUYER_REGISTERED",
      entityType: "User",
      entityId: createdUser.id,
      metadata: {
        companyName: input.companyName,
        role: "BUYER",
      },
      ...context,
    });

    return createdUser;
  });

  return buildSession(user, refreshToken);
};

const registerSupplier = async (input: RegisterSupplierInput, context: AuditContext) => {
  const passwordHash = await hashPassword(input.password);
  const refreshToken = generateRefreshToken();

  const user = await prisma.$transaction(async (tx) => {
    await ensurePublicRegistrationEmailAvailable(tx, input.email);

    const createdUser = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: "SUPPLIER",
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        supplierProfile: {
          create: {
            companyName: input.companyName,
            legalName: input.legalName,
            city: input.city,
            country: input.country,
          },
        },
      },
      include: userWithProfiles,
    });

    await createRefreshTokenRecord(tx, createdUser.id, refreshToken);

    await AuditService.create(tx, {
      actorId: createdUser.id,
      action: "SUPPLIER_REGISTERED",
      entityType: "User",
      entityId: createdUser.id,
      metadata: {
        companyName: input.companyName,
        role: "SUPPLIER",
        verificationStatus: "PENDING",
      },
      ...context,
    });

    return createdUser;
  });

  return buildSession(user, refreshToken);
};

const login = async (input: LoginInput, context: AuditContext) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: userWithProfiles,
  });

  if (!user?.passwordHash) {
    throw new AppError(401, "Invalid email or password");
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, "Invalid email or password");
  }

  if (user.deletedAt || user.status !== "ACTIVE") {
    throw new AppError(403, "This account is not active");
  }

  const refreshToken = generateRefreshToken();

  const updatedUser = await prisma.$transaction(async (tx) => {
    const currentUser = await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
      include: userWithProfiles,
    });

    await createRefreshTokenRecord(tx, user.id, refreshToken);

    await AuditService.create(tx, {
      actorId: user.id,
      action: "AUTH_LOGIN_SUCCEEDED",
      entityType: "User",
      entityId: user.id,
      metadata: {
        role: user.role,
      },
      ...context,
    });

    return currentUser;
  });

  return buildSession(updatedUser, refreshToken);
};

const refresh = async (input: RefreshTokenInput) => {
  const tokenHash = hashRefreshToken(input.refreshToken);
  const existingToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: userWithProfiles,
      },
    },
  });

  if (!existingToken || existingToken.revokedAt || existingToken.expiresAt <= new Date()) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  const { user } = existingToken;

  if (user.deletedAt || user.status !== "ACTIVE") {
    throw new AppError(403, "This account is not active");
  }

  const nextRefreshToken = generateRefreshToken();

  await prisma.$transaction(async (tx) => {
    const revocation = await tx.refreshToken.updateMany({
      where: {
        id: existingToken.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (revocation.count !== 1) {
      throw new AppError(401, "Refresh token has already been used");
    }

    await createRefreshTokenRecord(tx, user.id, nextRefreshToken);
  });

  return buildSession(user, nextRefreshToken);
};

const logout = async (input: RefreshTokenInput) => {
  const tokenHash = hashRefreshToken(input.refreshToken);

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  return null;
};

const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithProfiles,
  });

  if (!user || user.deletedAt) {
    throw new AppError(404, "User not found");
  }

  return toPublicUser(user);
};

export const AuthService = {
  registerBuyer,
  registerSupplier,
  login,
  refresh,
  logout,
  getCurrentUser,
};

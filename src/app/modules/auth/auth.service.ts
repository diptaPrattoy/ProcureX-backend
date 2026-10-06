import type { Prisma } from "../../../generated/prisma/client";
import { prisma } from "../../../lib/prisma.js";
import { AppError } from "../../errors/AppError.js";
import { hashOneTimeToken, issueOneTimeToken } from "../../utils/authToken.js";
import { verifyGoogleCredential } from "../../utils/googleAuth.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import {
  generateRefreshToken,
  getRefreshTokenExpiry,
  hashRefreshToken,
  signAccessToken,
} from "../../utils/token.js";
import { type AuditContext, AuditService } from "../audit/audit.service.js";
import { EmailService } from "../email/email.service.js";
import type {
  EmailOnlyInput,
  GoogleAuthInput,
  LoginInput,
  RefreshTokenInput,
  RegisterBuyerInput,
  RegisterSupplierInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from "./auth.validation.js";

const userWithProfiles = {
  buyerProfile: true,
  supplierProfile: true,
} satisfies Prisma.UserInclude;

type UserWithProfiles = Prisma.UserGetPayload<{
  include: typeof userWithProfiles;
}>;

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

const deliverVerificationEmail = async (
  user: UserWithProfiles,
  token: string,
) => {
  await EmailService.sendEmailVerification({
    email: user.email,
    firstName: user.firstName,
    token,
  });
};

const registerBuyer = async (
  input: RegisterBuyerInput,
  context: AuditContext,
) => {
  const passwordHash = await hashPassword(input.password);
  const refreshToken = generateRefreshToken();
  let verificationToken = "";

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
    verificationToken = await issueOneTimeToken(
      tx,
      createdUser.id,
      "EMAIL_VERIFICATION",
    );

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

  await deliverVerificationEmail(user, verificationToken);
  return buildSession(user, refreshToken);
};

const registerSupplier = async (
  input: RegisterSupplierInput,
  context: AuditContext,
) => {
  const passwordHash = await hashPassword(input.password);
  const refreshToken = generateRefreshToken();
  let verificationToken = "";

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
    verificationToken = await issueOneTimeToken(
      tx,
      createdUser.id,
      "EMAIL_VERIFICATION",
    );

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

  await deliverVerificationEmail(user, verificationToken);
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

  const passwordMatches = await verifyPassword(
    input.password,
    user.passwordHash,
  );

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
        method: "PASSWORD",
      },
      ...context,
    });

    return currentUser;
  });

  return buildSession(updatedUser, refreshToken);
};

const googleAuth = async (input: GoogleAuthInput, context: AuditContext) => {
  const googleIdentity = await verifyGoogleCredential(input.credential);
  const refreshToken = generateRefreshToken();

  const user = await prisma.$transaction(async (tx) => {
    const accountByGoogleId = await tx.user.findUnique({
      where: { googleId: googleIdentity.googleId },
      include: userWithProfiles,
    });
    const accountByEmail = await tx.user.findUnique({
      where: { email: googleIdentity.email },
      include: userWithProfiles,
    });

    if (
      accountByGoogleId &&
      accountByEmail &&
      accountByGoogleId.id !== accountByEmail.id
    ) {
      throw new AppError(
        409,
        "Google identity conflicts with an existing account",
      );
    }

    let existing = accountByGoogleId ?? accountByEmail;

    if (existing) {
      if (existing.deletedAt || existing.status !== "ACTIVE") {
        throw new AppError(403, "This account is not active");
      }

      if (existing.googleId && existing.googleId !== googleIdentity.googleId) {
        throw new AppError(
          409,
          "This email is linked to a different Google account",
        );
      }

      existing = await tx.user.update({
        where: { id: existing.id },
        data: {
          googleId: googleIdentity.googleId,
          emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
          avatarUrl: existing.avatarUrl ?? googleIdentity.avatarUrl,
          lastLoginAt: new Date(),
        },
        include: userWithProfiles,
      });
    } else {
      if (!input.role || !input.companyName) {
        throw new AppError(
          400,
          "role and companyName are required when creating a new account with Google",
        );
      }

      existing = await tx.user.create({
        data: {
          email: googleIdentity.email,
          googleId: googleIdentity.googleId,
          role: input.role,
          firstName: googleIdentity.firstName,
          lastName: googleIdentity.lastName,
          avatarUrl: googleIdentity.avatarUrl,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          buyerProfile:
            input.role === "BUYER"
              ? {
                  create: {
                    companyName: input.companyName,
                    legalName: input.legalName,
                    city: input.city,
                    country: input.country,
                  },
                }
              : undefined,
          supplierProfile:
            input.role === "SUPPLIER"
              ? {
                  create: {
                    companyName: input.companyName,
                    legalName: input.legalName,
                    city: input.city,
                    country: input.country,
                  },
                }
              : undefined,
        },
        include: userWithProfiles,
      });
    }

    await createRefreshTokenRecord(tx, existing.id, refreshToken);

    await AuditService.create(tx, {
      actorId: existing.id,
      action: "AUTH_GOOGLE_SUCCEEDED",
      entityType: "User",
      entityId: existing.id,
      metadata: {
        role: existing.role,
        method: "GOOGLE",
      },
      ...context,
    });

    return existing;
  });

  return buildSession(user, refreshToken);
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

  if (
    !existingToken ||
    existingToken.revokedAt ||
    existingToken.expiresAt <= new Date()
  ) {
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

const resendVerification = async (input: EmailOnlyInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: userWithProfiles,
  });

  if (
    !user ||
    user.deletedAt ||
    user.status !== "ACTIVE" ||
    user.emailVerifiedAt
  ) {
    return null;
  }

  const token = await prisma.$transaction((tx) =>
    issueOneTimeToken(tx, user.id, "EMAIL_VERIFICATION"),
  );
  await deliverVerificationEmail(user, token);
  return null;
};

const verifyEmail = async (input: VerifyEmailInput, context: AuditContext) => {
  const tokenHash = hashOneTimeToken(input.token);
  const token = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: { include: userWithProfiles } },
  });

  if (
    token?.type !== "EMAIL_VERIFICATION" ||
    token.consumedAt ||
    token.expiresAt <= new Date()
  ) {
    throw new AppError(400, "Invalid or expired email verification token");
  }

  const user = await prisma.$transaction(async (tx) => {
    const consumed = await tx.authToken.updateMany({
      where: {
        id: token.id,
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    if (consumed.count !== 1) {
      throw new AppError(400, "Email verification token has already been used");
    }

    const updatedUser = await tx.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: token.user.emailVerifiedAt ?? new Date() },
      include: userWithProfiles,
    });

    await AuditService.create(tx, {
      actorId: token.userId,
      action: "EMAIL_VERIFIED",
      entityType: "User",
      entityId: token.userId,
      ...context,
    });

    return updatedUser;
  });

  return toPublicUser(user);
};

const forgotPassword = async (input: EmailOnlyInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: userWithProfiles,
  });

  // Deliberately return the same response for unknown, disabled, deleted, and Google-only accounts.
  if (
    !user ||
    user.deletedAt ||
    user.status !== "ACTIVE" ||
    !user.passwordHash
  ) {
    return null;
  }

  const token = await prisma.$transaction((tx) =>
    issueOneTimeToken(tx, user.id, "PASSWORD_RESET"),
  );
  await EmailService.sendPasswordReset({
    email: user.email,
    firstName: user.firstName,
    token,
  });

  return null;
};

const resetPassword = async (
  input: ResetPasswordInput,
  context: AuditContext,
) => {
  const tokenHash = hashOneTimeToken(input.token);
  const token = await prisma.authToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (
    token?.type !== "PASSWORD_RESET" ||
    token.consumedAt ||
    token.expiresAt <= new Date()
  ) {
    throw new AppError(400, "Invalid or expired password reset token");
  }

  if (token.user.deletedAt || token.user.status !== "ACTIVE") {
    throw new AppError(403, "This account is not active");
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    const consumed = await tx.authToken.updateMany({
      where: { id: token.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    if (consumed.count !== 1) {
      throw new AppError(400, "Password reset token has already been used");
    }

    await tx.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    });

    await tx.refreshToken.updateMany({
      where: { userId: token.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.authToken.updateMany({
      where: {
        userId: token.userId,
        type: "PASSWORD_RESET",
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    await AuditService.create(tx, {
      actorId: token.userId,
      action: "PASSWORD_RESET_COMPLETED",
      entityType: "User",
      entityId: token.userId,
      ...context,
    });
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
  googleAuth,
  refresh,
  logout,
  resendVerification,
  verifyEmail,
  forgotPassword,
  resetPassword,
  getCurrentUser,
};

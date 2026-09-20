import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must include at least one special character");

const commonRegistrationFields = {
  firstName: z.string().trim().min(2).max(60),
  lastName: z.string().trim().min(2).max(60),
  email: emailSchema,
  password: passwordSchema,
  phone: z.string().trim().min(7).max(30).optional(),
};

export const registerBuyerSchema = z.object({
  ...commonRegistrationFields,
  companyName: z.string().trim().min(2).max(160),
  legalName: z.string().trim().min(2).max(180).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  country: z.string().trim().min(2).max(100).optional(),
});

export const registerSupplierSchema = z.object({
  ...commonRegistrationFields,
  companyName: z.string().trim().min(2).max(160),
  legalName: z.string().trim().min(2).max(180).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  country: z.string().trim().min(2).max(100).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(32, "Refresh token is required"),
});

export const logoutSchema = refreshTokenSchema;

export const googleAuthSchema = z.object({
  credential: z.string().trim().min(20, "Google credential is required"),
  role: z.enum(["BUYER", "SUPPLIER"]).optional(),
  companyName: z.string().trim().min(2).max(160).optional(),
  legalName: z.string().trim().min(2).max(180).optional(),
  city: z.string().trim().min(2).max(100).optional(),
  country: z.string().trim().min(2).max(100).optional(),
});

export const emailOnlySchema = z.object({
  email: emailSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().trim().min(32, "Verification token is required"),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(32, "Password reset token is required"),
  newPassword: passwordSchema,
});

export type RegisterBuyerInput = z.infer<typeof registerBuyerSchema>;
export type RegisterSupplierInput = z.infer<typeof registerSupplierSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type EmailOnlyInput = z.infer<typeof emailOnlySchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

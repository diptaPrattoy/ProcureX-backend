import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { authSensitiveRateLimiter } from "../../middlewares/rateLimiter.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { AuthController } from "./auth.controller.js";
import {
  emailOnlySchema,
  googleAuthSchema,
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerBuyerSchema,
  registerSupplierSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.validation.js";

const router = Router();

router.post(
  "/register/buyer",
  authSensitiveRateLimiter,
  validateBody(registerBuyerSchema),
  AuthController.registerBuyer,
);

router.post(
  "/register/supplier",
  authSensitiveRateLimiter,
  validateBody(registerSupplierSchema),
  AuthController.registerSupplier,
);

router.post(
  "/login",
  authSensitiveRateLimiter,
  validateBody(loginSchema),
  AuthController.login,
);
router.post(
  "/google",
  authSensitiveRateLimiter,
  validateBody(googleAuthSchema),
  AuthController.googleAuth,
);
router.post(
  "/refresh",
  validateBody(refreshTokenSchema),
  AuthController.refresh,
);
router.post("/logout", validateBody(logoutSchema), AuthController.logout);
router.post(
  "/email/resend-verification",
  authSensitiveRateLimiter,
  validateBody(emailOnlySchema),
  AuthController.resendVerification,
);
router.post(
  "/email/verify",
  authSensitiveRateLimiter,
  validateBody(verifyEmailSchema),
  AuthController.verifyEmail,
);
router.post(
  "/forgot-password",
  authSensitiveRateLimiter,
  validateBody(emailOnlySchema),
  AuthController.forgotPassword,
);
router.post(
  "/reset-password",
  authSensitiveRateLimiter,
  validateBody(resetPasswordSchema),
  AuthController.resetPassword,
);
router.get("/me", requireAuth, AuthController.me);

export const AuthRoutes = router;

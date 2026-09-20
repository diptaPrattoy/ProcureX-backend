import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import { authSensitiveRateLimiter } from "../../middlewares/rateLimiter.js";
import { validateBody } from "../../middlewares/validateRequest.js";
import { AuthController } from "./auth.controller.js";
import {
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerBuyerSchema,
  registerSupplierSchema,
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

router.post("/login", authSensitiveRateLimiter, validateBody(loginSchema), AuthController.login);
router.post("/refresh", validateBody(refreshTokenSchema), AuthController.refresh);
router.post("/logout", validateBody(logoutSchema), AuthController.logout);
router.get("/me", requireAuth, AuthController.me);

export const AuthRoutes = router;

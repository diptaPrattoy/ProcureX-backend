import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AuthService } from "./auth.service.js";

const getAuditContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

const registerBuyer = catchAsync(async (req, res) => {
  const result = await AuthService.registerBuyer(
    req.body,
    getAuditContext(req),
  );

  sendResponse(res, {
    statusCode: 201,
    message: "Buyer account created successfully",
    data: result,
  });
});

const registerSupplier = catchAsync(async (req, res) => {
  const result = await AuthService.registerSupplier(
    req.body,
    getAuditContext(req),
  );

  sendResponse(res, {
    statusCode: 201,
    message:
      "Supplier account created successfully and is pending verification",
    data: result,
  });
});

const login = catchAsync(async (req, res) => {
  const result = await AuthService.login(req.body, getAuditContext(req));

  sendResponse(res, {
    statusCode: 200,
    message: "Login successful",
    data: result,
  });
});

const googleAuth = catchAsync(async (req, res) => {
  const result = await AuthService.googleAuth(req.body, getAuditContext(req));

  sendResponse(res, {
    statusCode: 200,
    message: "Google authentication successful",
    data: result,
  });
});

const refresh = catchAsync(async (req, res) => {
  const result = await AuthService.refresh(req.body);

  sendResponse(res, {
    statusCode: 200,
    message: "Session refreshed successfully",
    data: result,
  });
});

const logout = catchAsync(async (req, res) => {
  await AuthService.logout(req.body);

  sendResponse(res, {
    statusCode: 200,
    message: "Logout successful",
    data: null,
  });
});

const resendVerification = catchAsync(async (req, res) => {
  await AuthService.resendVerification(req.body);

  sendResponse(res, {
    statusCode: 200,
    message:
      "If the account needs verification, a verification email has been sent",
    data: null,
  });
});

const verifyEmail = catchAsync(async (req, res) => {
  const user = await AuthService.verifyEmail(req.body, getAuditContext(req));

  sendResponse(res, {
    statusCode: 200,
    message: "Email verified successfully",
    data: user,
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  await AuthService.forgotPassword(req.body);

  sendResponse(res, {
    statusCode: 200,
    message:
      "If the account can reset a password, reset instructions have been sent",
    data: null,
  });
});

const resetPassword = catchAsync(async (req, res) => {
  await AuthService.resetPassword(req.body, getAuditContext(req));

  sendResponse(res, {
    statusCode: 200,
    message: "Password reset successfully. Please sign in again.",
    data: null,
  });
});

const me = catchAsync(async (req, res: Response) => {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }

  const user = await AuthService.getCurrentUser(req.authUser.id);

  sendResponse(res, {
    statusCode: 200,
    message: "Current user retrieved successfully",
    data: user,
  });
});

export const AuthController = {
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
  me,
};

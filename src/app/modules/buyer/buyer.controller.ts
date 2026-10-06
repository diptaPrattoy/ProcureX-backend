import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { BuyerService } from "./buyer.service.js";

const getAuditContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

const requireUserId = (req: Request): string => {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  return req.authUser.id;
};

const getMyProfile = catchAsync(async (req: Request, res: Response) => {
  const data = await BuyerService.getMyProfile(requireUserId(req));
  sendResponse(res, {
    statusCode: 200,
    message: "Buyer profile retrieved successfully",
    data,
  });
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const data = await BuyerService.updateMyProfile(
    requireUserId(req),
    req.body,
    getAuditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Buyer profile updated successfully",
    data,
  });
});

export const BuyerController = { getMyProfile, updateMyProfile };

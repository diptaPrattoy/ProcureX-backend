import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { ActivityService } from "./activity.service.js";
import {
  adminAuditQuerySchema,
  auditLogIdParamSchema,
  myActivityQuerySchema,
} from "./activity.validation.js";

const requireUser = (req: Request) => {
  if (!req.authUser) throw new AppError(401, "Authentication required");
  return req.authUser.id;
};

const requireAdmin = (req: Request) => {
  if (!req.authUser) throw new AppError(401, "Authentication required");
  if (req.authUser.role !== "ADMIN") throw new AppError(403, "Administrator access required");
};

const listMine = catchAsync(async (req: Request, res: Response) => {
  const userId = requireUser(req);
  const query = myActivityQuerySchema.parse(req.query);
  const data = await ActivityService.listMine(userId, query);
  sendResponse(res, { statusCode: 200, message: "Activity history retrieved successfully", data });
});

const listAdmin = catchAsync(async (req: Request, res: Response) => {
  requireAdmin(req);
  const query = adminAuditQuerySchema.parse(req.query);
  const data = await ActivityService.listAdmin(query);
  sendResponse(res, { statusCode: 200, message: "Audit logs retrieved successfully", data });
});

const getAdminById = catchAsync(async (req: Request, res: Response) => {
  requireAdmin(req);
  const { auditLogId } = auditLogIdParamSchema.parse(req.params);
  const data = await ActivityService.getAdminById(auditLogId);
  sendResponse(res, { statusCode: 200, message: "Audit log retrieved successfully", data });
});

export const ActivityController = {
  listMine,
  listAdmin,
  getAdminById,
};

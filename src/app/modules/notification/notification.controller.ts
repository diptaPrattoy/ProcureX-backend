import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { NotificationService } from "./notification.service.js";
import {
  notificationIdParamSchema,
  notificationListQuerySchema,
} from "./notification.validation.js";

const requireUser = (req: Request) => {
  if (!req.authUser) throw new AppError(401, "Authentication required");
  return req.authUser.id;
};

const listMine = catchAsync(async (req: Request, res: Response) => {
  const userId = requireUser(req);
  const query = notificationListQuerySchema.parse(req.query);
  const data = await NotificationService.listMine(userId, query);
  sendResponse(res, { statusCode: 200, message: "Notifications retrieved successfully", data });
});

const unreadCount = catchAsync(async (req: Request, res: Response) => {
  const userId = requireUser(req);
  const data = await NotificationService.unreadCount(userId);
  sendResponse(res, { statusCode: 200, message: "Unread notification count retrieved successfully", data });
});

const markRead = catchAsync(async (req: Request, res: Response) => {
  const userId = requireUser(req);
  const { notificationId } = notificationIdParamSchema.parse(req.params);
  const data = await NotificationService.markRead(userId, notificationId);
  sendResponse(res, { statusCode: 200, message: "Notification marked as read", data });
});

const markAllRead = catchAsync(async (req: Request, res: Response) => {
  const userId = requireUser(req);
  const data = await NotificationService.markAllRead(userId);
  sendResponse(res, { statusCode: 200, message: "All notifications marked as read", data });
});

export const NotificationController = {
  listMine,
  unreadCount,
  markRead,
  markAllRead,
};

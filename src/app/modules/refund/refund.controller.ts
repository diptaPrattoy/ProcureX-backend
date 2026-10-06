import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { RefundService } from "./refund.service.js";
import {
  approveRefundSchema,
  paymentRefundParamSchema,
  refundIdParamSchema,
  refundListQuerySchema,
  rejectRefundSchema,
  requestRefundSchema,
} from "./refund.validation.js";

const auditContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

const requireBuyer = (req: Request) => {
  if (!req.authUser) throw new AppError(401, "Authentication required");
  if (req.authUser.role !== "BUYER")
    throw new AppError(403, "Only buyers can manage refund requests");
  return req.authUser.id;
};

const requireAdmin = (req: Request) => {
  if (!req.authUser) throw new AppError(401, "Authentication required");
  if (req.authUser.role !== "ADMIN")
    throw new AppError(403, "Administrator access required");
  return req.authUser.id;
};

const requestRefund = catchAsync(async (req: Request, res: Response) => {
  const buyerId = requireBuyer(req);
  const { paymentId } = paymentRefundParamSchema.parse(req.params);
  const input = requestRefundSchema.parse(req.body);
  const data = await RefundService.requestRefund(
    buyerId,
    paymentId,
    input,
    auditContext(req),
  );
  sendResponse(res, {
    statusCode: 201,
    message: "Refund request submitted successfully",
    data,
  });
});

const listMine = catchAsync(async (req: Request, res: Response) => {
  const buyerId = requireBuyer(req);
  const query = refundListQuerySchema.parse(req.query);
  const data = await RefundService.listMine(buyerId, query);
  sendResponse(res, {
    statusCode: 200,
    message: "Refund requests retrieved successfully",
    data,
  });
});

const getMineById = catchAsync(async (req: Request, res: Response) => {
  const buyerId = requireBuyer(req);
  const { refundId } = refundIdParamSchema.parse(req.params);
  const data = await RefundService.getMineById(buyerId, refundId);
  sendResponse(res, {
    statusCode: 200,
    message: "Refund request retrieved successfully",
    data,
  });
});

const cancelMine = catchAsync(async (req: Request, res: Response) => {
  const buyerId = requireBuyer(req);
  const { refundId } = refundIdParamSchema.parse(req.params);
  const data = await RefundService.cancelMine(
    buyerId,
    refundId,
    auditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Refund request cancelled successfully",
    data,
  });
});

const listAdmin = catchAsync(async (req: Request, res: Response) => {
  requireAdmin(req);
  const query = refundListQuerySchema.parse(req.query);
  const data = await RefundService.listAdmin(query);
  sendResponse(res, {
    statusCode: 200,
    message: "Refund queue retrieved successfully",
    data,
  });
});

const getAdminById = catchAsync(async (req: Request, res: Response) => {
  requireAdmin(req);
  const { refundId } = refundIdParamSchema.parse(req.params);
  const data = await RefundService.getAdminById(refundId);
  sendResponse(res, {
    statusCode: 200,
    message: "Refund request retrieved successfully",
    data,
  });
});

const approve = catchAsync(async (req: Request, res: Response) => {
  const adminId = requireAdmin(req);
  const { refundId } = refundIdParamSchema.parse(req.params);
  const { note } = approveRefundSchema.parse(req.body);
  const data = await RefundService.approve(
    adminId,
    refundId,
    note,
    auditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Refund approved and submitted to Stripe",
    data,
  });
});

const reject = catchAsync(async (req: Request, res: Response) => {
  const adminId = requireAdmin(req);
  const { refundId } = refundIdParamSchema.parse(req.params);
  const { note } = rejectRefundSchema.parse(req.body);
  const data = await RefundService.reject(
    adminId,
    refundId,
    note,
    auditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Refund request rejected successfully",
    data,
  });
});

const retry = catchAsync(async (req: Request, res: Response) => {
  const adminId = requireAdmin(req);
  const { refundId } = refundIdParamSchema.parse(req.params);
  const data = await RefundService.retry(adminId, refundId, auditContext(req));
  sendResponse(res, {
    statusCode: 200,
    message: "Refund provider retry submitted",
    data,
  });
});

export const RefundController = {
  requestRefund,
  listMine,
  getMineById,
  cancelMine,
  listAdmin,
  getAdminById,
  approve,
  reject,
  retry,
};

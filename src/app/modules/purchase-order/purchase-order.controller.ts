import type { Request, Response } from "express";
import type { UserRole } from "../../../generated/prisma/client.js";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { PurchaseOrderService } from "./purchase-order.service.js";
import {
  purchaseOrderIdParamSchema,
  purchaseOrderListQuerySchema,
} from "./purchase-order.validation.js";

const getAuditContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

const requirePrincipal = (req: Request): { id: string; role: Extract<UserRole, "BUYER" | "SUPPLIER"> } => {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  if (req.authUser.role !== "BUYER" && req.authUser.role !== "SUPPLIER") {
    throw new AppError(403, "Only buyers and suppliers can access purchase orders");
  }
  return { id: req.authUser.id, role: req.authUser.role };
};

const listMine = catchAsync(async (req: Request, res: Response) => {
  const principal = requirePrincipal(req);
  const query = purchaseOrderListQuerySchema.parse(req.query);
  const data = await PurchaseOrderService.listMine(principal.id, principal.role, query);
  sendResponse(res, { statusCode: 200, message: "Purchase orders retrieved successfully", data });
});

const getMineById = catchAsync(async (req: Request, res: Response) => {
  const principal = requirePrincipal(req);
  const { purchaseOrderId } = purchaseOrderIdParamSchema.parse(req.params);
  const data = await PurchaseOrderService.getMineById(principal.id, principal.role, purchaseOrderId);
  sendResponse(res, { statusCode: 200, message: "Purchase order retrieved successfully", data });
});

const accept = catchAsync(async (req: Request, res: Response) => {
  const { purchaseOrderId } = purchaseOrderIdParamSchema.parse(req.params);
  const userId = requirePrincipal(req).id;
  const data = await PurchaseOrderService.accept(userId, purchaseOrderId, getAuditContext(req));
  sendResponse(res, { statusCode: 200, message: "Purchase order accepted successfully", data });
});

const reject = catchAsync(async (req: Request, res: Response) => {
  const { purchaseOrderId } = purchaseOrderIdParamSchema.parse(req.params);
  const userId = requirePrincipal(req).id;
  const data = await PurchaseOrderService.reject(userId, purchaseOrderId, getAuditContext(req));
  sendResponse(res, { statusCode: 200, message: "Purchase order rejected successfully", data });
});

const startFulfillment = catchAsync(async (req: Request, res: Response) => {
  const { purchaseOrderId } = purchaseOrderIdParamSchema.parse(req.params);
  const userId = requirePrincipal(req).id;
  const data = await PurchaseOrderService.startFulfillment(userId, purchaseOrderId, getAuditContext(req));
  sendResponse(res, { statusCode: 200, message: "Purchase order fulfillment started", data });
});

const cancel = catchAsync(async (req: Request, res: Response) => {
  const { purchaseOrderId } = purchaseOrderIdParamSchema.parse(req.params);
  const userId = requirePrincipal(req).id;
  const data = await PurchaseOrderService.cancelByBuyer(userId, purchaseOrderId, getAuditContext(req));
  sendResponse(res, { statusCode: 200, message: "Purchase order cancelled successfully", data });
});

export const PurchaseOrderController = {
  listMine,
  getMineById,
  accept,
  reject,
  startFulfillment,
  cancel,
};

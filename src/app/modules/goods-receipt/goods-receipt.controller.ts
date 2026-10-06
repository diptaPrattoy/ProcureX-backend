import type { Request, Response } from "express";
import type { UserRole } from "../../../generated/prisma/client.js";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { GoodsReceiptService } from "./goods-receipt.service.js";
import {
  createGoodsReceiptSchema,
  goodsReceiptIdParamSchema,
  goodsReceiptListQuerySchema,
  purchaseOrderReceiptParamSchema,
} from "./goods-receipt.validation.js";

const getAuditContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

const requirePrincipal = (
  req: Request,
): { id: string; role: Extract<UserRole, "BUYER" | "SUPPLIER"> } => {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  if (req.authUser.role !== "BUYER" && req.authUser.role !== "SUPPLIER") {
    throw new AppError(
      403,
      "Only buyers and suppliers can access goods receipts",
    );
  }
  return { id: req.authUser.id, role: req.authUser.role };
};

const create = catchAsync(async (req: Request, res: Response) => {
  const principal = requirePrincipal(req);
  if (principal.role !== "BUYER") {
    throw new AppError(403, "Only the buyer can record goods receipts");
  }
  const { purchaseOrderId } = purchaseOrderReceiptParamSchema.parse(req.params);
  const input = createGoodsReceiptSchema.parse(req.body);
  const data = await GoodsReceiptService.create(
    principal.id,
    purchaseOrderId,
    input,
    getAuditContext(req),
  );
  sendResponse(res, {
    statusCode: 201,
    message: "Goods receipt recorded successfully",
    data,
  });
});

const listByPurchaseOrder = catchAsync(async (req: Request, res: Response) => {
  const principal = requirePrincipal(req);
  const { purchaseOrderId } = purchaseOrderReceiptParamSchema.parse(req.params);
  const query = goodsReceiptListQuerySchema.parse(req.query);
  const data = await GoodsReceiptService.listByPurchaseOrder(
    principal.id,
    principal.role,
    purchaseOrderId,
    query,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Goods receipts retrieved successfully",
    data,
  });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const principal = requirePrincipal(req);
  const { goodsReceiptId } = goodsReceiptIdParamSchema.parse(req.params);
  const data = await GoodsReceiptService.getById(
    principal.id,
    principal.role,
    goodsReceiptId,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Goods receipt retrieved successfully",
    data,
  });
});

export const GoodsReceiptController = {
  create,
  listByPurchaseOrder,
  getById,
};

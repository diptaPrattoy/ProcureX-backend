import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { SupplierService } from "./supplier.service.js";
import {
  adminSupplierListQuerySchema,
  supplierIdParamSchema,
  supplierListQuerySchema,
} from "./supplier.validation.js";

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
  const data = await SupplierService.getMyProfile(requireUserId(req));
  sendResponse(res, { statusCode: 200, message: "Supplier profile retrieved successfully", data });
});

const updateMyProfile = catchAsync(async (req: Request, res: Response) => {
  const data = await SupplierService.updateMyProfile(
    requireUserId(req),
    req.body,
    getAuditContext(req),
  );
  sendResponse(res, { statusCode: 200, message: "Supplier profile updated successfully", data });
});

const setMyCategories = catchAsync(async (req: Request, res: Response) => {
  const data = await SupplierService.setMyCategories(
    requireUserId(req),
    req.body,
    getAuditContext(req),
  );
  sendResponse(res, { statusCode: 200, message: "Supplier categories updated successfully", data });
});

const listVerified = catchAsync(async (req: Request, res: Response) => {
  const query = supplierListQuerySchema.parse(req.query);
  const data = await SupplierService.listVerified(query);
  sendResponse(res, { statusCode: 200, message: "Verified suppliers retrieved successfully", data });
});

const getVerifiedById = catchAsync(async (req: Request, res: Response) => {
  const { supplierId } = supplierIdParamSchema.parse(req.params);
  const data = await SupplierService.getVerifiedById(supplierId);
  sendResponse(res, { statusCode: 200, message: "Verified supplier retrieved successfully", data });
});

const listForAdmin = catchAsync(async (req: Request, res: Response) => {
  const query = adminSupplierListQuerySchema.parse(req.query);
  const data = await SupplierService.listForAdmin(query);
  sendResponse(res, { statusCode: 200, message: "Supplier verification queue retrieved successfully", data });
});

const updateVerification = catchAsync(async (req: Request, res: Response) => {
  const { supplierId } = supplierIdParamSchema.parse(req.params);
  const data = await SupplierService.updateVerification(
    requireUserId(req),
    supplierId,
    req.body,
    getAuditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: req.body.status === "VERIFIED" ? "Supplier verified successfully" : "Supplier rejected",
    data,
  });
});

export const SupplierController = {
  getMyProfile,
  updateMyProfile,
  setMyCategories,
  listVerified,
  getVerifiedById,
  listForAdmin,
  updateVerification,
};

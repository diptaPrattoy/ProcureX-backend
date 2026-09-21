import type { Request, Response } from "express";
import type { UserRole } from "../../../generated/prisma/client.js";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { InvoiceService } from "./invoice.service.js";
import {
  createInvoiceSchema,
  invoiceIdParamSchema,
  invoiceListQuerySchema,
  purchaseOrderInvoiceParamSchema,
} from "./invoice.validation.js";

const getAuditContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

const requirePrincipal = (req: Request): { id: string; role: Extract<UserRole, "BUYER" | "SUPPLIER"> } => {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  if (req.authUser.role !== "BUYER" && req.authUser.role !== "SUPPLIER") {
    throw new AppError(403, "Only buyers and suppliers can access invoices");
  }
  return { id: req.authUser.id, role: req.authUser.role };
};

const create = catchAsync(async (req: Request, res: Response) => {
  const principal = requirePrincipal(req);
  if (principal.role !== "SUPPLIER") {
    throw new AppError(403, "Only the supplier can submit invoices");
  }
  const { purchaseOrderId } = purchaseOrderInvoiceParamSchema.parse(req.params);
  const input = createInvoiceSchema.parse(req.body);
  const data = await InvoiceService.create(
    principal.id,
    purchaseOrderId,
    input,
    getAuditContext(req),
  );
  sendResponse(res, { statusCode: 201, message: "Invoice submitted successfully", data });
});

const listMine = catchAsync(async (req: Request, res: Response) => {
  const principal = requirePrincipal(req);
  const query = invoiceListQuerySchema.parse(req.query);
  const data = await InvoiceService.listMine(principal.id, principal.role, query);
  sendResponse(res, { statusCode: 200, message: "Invoices retrieved successfully", data });
});

const listByPurchaseOrder = catchAsync(async (req: Request, res: Response) => {
  const principal = requirePrincipal(req);
  const { purchaseOrderId } = purchaseOrderInvoiceParamSchema.parse(req.params);
  const query = invoiceListQuerySchema.parse(req.query);
  const data = await InvoiceService.listByPurchaseOrder(
    principal.id,
    principal.role,
    purchaseOrderId,
    query,
  );
  sendResponse(res, { statusCode: 200, message: "Purchase order invoices retrieved successfully", data });
});

const getById = catchAsync(async (req: Request, res: Response) => {
  const principal = requirePrincipal(req);
  const { invoiceId } = invoiceIdParamSchema.parse(req.params);
  const data = await InvoiceService.getById(principal.id, principal.role, invoiceId);
  sendResponse(res, { statusCode: 200, message: "Invoice retrieved successfully", data });
});

const cancel = catchAsync(async (req: Request, res: Response) => {
  const principal = requirePrincipal(req);
  if (principal.role !== "SUPPLIER") {
    throw new AppError(403, "Only the supplier can cancel an invoice");
  }
  const { invoiceId } = invoiceIdParamSchema.parse(req.params);
  const data = await InvoiceService.cancel(principal.id, invoiceId, getAuditContext(req));
  sendResponse(res, { statusCode: 200, message: "Invoice cancelled successfully", data });
});

export const InvoiceController = {
  create,
  listMine,
  listByPurchaseOrder,
  getById,
  cancel,
};

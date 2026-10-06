import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { DisputeService } from "./dispute.service.js";
import {
  disputeIdParamSchema,
  disputeListQuerySchema,
  invoiceDisputeParamSchema,
  openDisputeSchema,
  purchaseOrderDisputeParamSchema,
  rejectDisputeSchema,
  resolveDisputeSchema,
} from "./dispute.validation.js";

const auditContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

const requireParticipant = (req: Request) => {
  if (!req.authUser) throw new AppError(401, "Authentication required");
  if (req.authUser.role !== "BUYER" && req.authUser.role !== "SUPPLIER") {
    throw new AppError(403, "Only buyers and suppliers can manage disputes");
  }
  return req.authUser;
};

const requireAdmin = (req: Request) => {
  if (!req.authUser) throw new AppError(401, "Authentication required");
  if (req.authUser.role !== "ADMIN")
    throw new AppError(403, "Administrator access required");
  return req.authUser.id;
};

const openForPurchaseOrder = catchAsync(async (req: Request, res: Response) => {
  const user = requireParticipant(req);
  const { purchaseOrderId } = purchaseOrderDisputeParamSchema.parse(req.params);
  const input = openDisputeSchema.parse(req.body);
  const data = await DisputeService.openForPurchaseOrder(
    user.id,
    user.role,
    purchaseOrderId,
    input,
    auditContext(req),
  );
  sendResponse(res, {
    statusCode: 201,
    message: "Purchase order dispute opened successfully",
    data,
  });
});

const openForInvoice = catchAsync(async (req: Request, res: Response) => {
  const user = requireParticipant(req);
  const { invoiceId } = invoiceDisputeParamSchema.parse(req.params);
  const input = openDisputeSchema.parse(req.body);
  const data = await DisputeService.openForInvoice(
    user.id,
    user.role,
    invoiceId,
    input,
    auditContext(req),
  );
  sendResponse(res, {
    statusCode: 201,
    message: "Invoice dispute opened successfully",
    data,
  });
});

const listMine = catchAsync(async (req: Request, res: Response) => {
  const user = requireParticipant(req);
  const query = disputeListQuerySchema.parse(req.query);
  const data = await DisputeService.listMine(user.id, query);
  sendResponse(res, {
    statusCode: 200,
    message: "Disputes retrieved successfully",
    data,
  });
});

const getMineById = catchAsync(async (req: Request, res: Response) => {
  const user = requireParticipant(req);
  const { disputeId } = disputeIdParamSchema.parse(req.params);
  const data = await DisputeService.getMineById(user.id, disputeId);
  sendResponse(res, {
    statusCode: 200,
    message: "Dispute retrieved successfully",
    data,
  });
});

const listAdmin = catchAsync(async (req: Request, res: Response) => {
  requireAdmin(req);
  const query = disputeListQuerySchema.parse(req.query);
  const data = await DisputeService.listAdmin(query);
  sendResponse(res, {
    statusCode: 200,
    message: "Dispute queue retrieved successfully",
    data,
  });
});

const getAdminById = catchAsync(async (req: Request, res: Response) => {
  requireAdmin(req);
  const { disputeId } = disputeIdParamSchema.parse(req.params);
  const data = await DisputeService.getAdminById(disputeId);
  sendResponse(res, {
    statusCode: 200,
    message: "Dispute retrieved successfully",
    data,
  });
});

const startReview = catchAsync(async (req: Request, res: Response) => {
  const adminId = requireAdmin(req);
  const { disputeId } = disputeIdParamSchema.parse(req.params);
  const data = await DisputeService.startReview(
    adminId,
    disputeId,
    auditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Dispute review started successfully",
    data,
  });
});

const resolve = catchAsync(async (req: Request, res: Response) => {
  const adminId = requireAdmin(req);
  const { disputeId } = disputeIdParamSchema.parse(req.params);
  const { resolution } = resolveDisputeSchema.parse(req.body);
  const data = await DisputeService.resolve(
    adminId,
    disputeId,
    resolution,
    auditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Dispute resolved successfully",
    data,
  });
});

const reject = catchAsync(async (req: Request, res: Response) => {
  const adminId = requireAdmin(req);
  const { disputeId } = disputeIdParamSchema.parse(req.params);
  const { resolution } = rejectDisputeSchema.parse(req.body);
  const data = await DisputeService.reject(
    adminId,
    disputeId,
    resolution,
    auditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Dispute rejected successfully",
    data,
  });
});

export const DisputeController = {
  openForPurchaseOrder,
  openForInvoice,
  listMine,
  getMineById,
  listAdmin,
  getAdminById,
  startReview,
  resolve,
  reject,
};

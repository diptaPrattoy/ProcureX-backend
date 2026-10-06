import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { PaymentService } from "./payment.service.js";
import {
  invoicePaymentParamSchema,
  paymentIdParamSchema,
  paymentListQuerySchema,
} from "./payment.validation.js";

const requireBuyer = (req: Request) => {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  if (req.authUser.role !== "BUYER") {
    throw new AppError(403, "Only buyers can manage payments");
  }
  return req.authUser.id;
};

const auditContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

const createCheckout = catchAsync(async (req: Request, res: Response) => {
  const buyerId = requireBuyer(req);
  const { invoiceId } = invoicePaymentParamSchema.parse(req.params);
  const data = await PaymentService.createCheckout(
    buyerId,
    invoiceId,
    auditContext(req),
  );
  sendResponse(res, {
    statusCode: 201,
    message: "Stripe checkout session ready",
    data,
  });
});

const listMine = catchAsync(async (req: Request, res: Response) => {
  const buyerId = requireBuyer(req);
  const query = paymentListQuerySchema.parse(req.query);
  const data = await PaymentService.listMine(buyerId, query);
  sendResponse(res, {
    statusCode: 200,
    message: "Payments retrieved successfully",
    data,
  });
});

const getMineById = catchAsync(async (req: Request, res: Response) => {
  const buyerId = requireBuyer(req);
  const { paymentId } = paymentIdParamSchema.parse(req.params);
  const data = await PaymentService.getMineById(buyerId, paymentId);
  sendResponse(res, {
    statusCode: 200,
    message: "Payment retrieved successfully",
    data,
  });
});

export const PaymentController = { createCheckout, listMine, getMineById };

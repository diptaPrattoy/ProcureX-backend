import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { BuyerQuotationService } from "./quotation.buyer.service.js";
import {
  buyerQuotationListQuerySchema,
  quotationRfqIdParamSchema,
  rfqQuotationParamsSchema,
} from "./quotation.validation.js";

const getAuditContext = (req: Request) => ({
  ipAddress: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

const requireUserId = (req: Request) => {
  if (!req.authUser) {
    throw new AppError(401, "Authentication required");
  }
  return req.authUser.id;
};

const listForBuyer = catchAsync(async (req: Request, res: Response) => {
  const { rfqId } = quotationRfqIdParamSchema.parse(req.params);
  const query = buyerQuotationListQuerySchema.parse(req.query);
  const data = await BuyerQuotationService.listForBuyer(
    requireUserId(req),
    rfqId,
    query,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "RFQ quotations retrieved successfully",
    data,
  });
});

const getForBuyer = catchAsync(async (req: Request, res: Response) => {
  const { rfqId, quotationId } = rfqQuotationParamsSchema.parse(req.params);
  const data = await BuyerQuotationService.getForBuyer(
    requireUserId(req),
    rfqId,
    quotationId,
  );
  sendResponse(res, {
    statusCode: 200,
    message: "Quotation retrieved successfully",
    data,
  });
});

const startEvaluation = catchAsync(async (req: Request, res: Response) => {
  const { rfqId } = quotationRfqIdParamSchema.parse(req.params);
  const data = await BuyerQuotationService.startEvaluation(
    requireUserId(req),
    rfqId,
    getAuditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: "RFQ evaluation started successfully",
    data,
  });
});

const award = catchAsync(async (req: Request, res: Response) => {
  const { rfqId, quotationId } = rfqQuotationParamsSchema.parse(req.params);
  const data = await BuyerQuotationService.award(
    requireUserId(req),
    rfqId,
    quotationId,
    getAuditContext(req),
  );
  sendResponse(res, {
    statusCode: 201,
    message: "Quotation awarded and purchase order issued successfully",
    data,
  });
});

export const BuyerQuotationController = {
  listForBuyer,
  getForBuyer,
  startEvaluation,
  award,
};

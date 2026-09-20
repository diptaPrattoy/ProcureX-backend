import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { QuotationService } from "./quotation.service.js";
import {
  myQuotationListQuerySchema,
  quotationIdParamSchema,
  quotationRfqIdParamSchema,
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

const submit = catchAsync(async (req: Request, res: Response) => {
  const { rfqId } = quotationRfqIdParamSchema.parse(req.params);
  const data = await QuotationService.submit(
    requireUserId(req),
    rfqId,
    req.body,
    getAuditContext(req),
  );
  sendResponse(res, { statusCode: 201, message: "Quotation submitted successfully", data });
});

const listMine = catchAsync(async (req: Request, res: Response) => {
  const query = myQuotationListQuerySchema.parse(req.query);
  const data = await QuotationService.listMine(requireUserId(req), query);
  sendResponse(res, { statusCode: 200, message: "Supplier quotations retrieved successfully", data });
});

const getMineById = catchAsync(async (req: Request, res: Response) => {
  const { quotationId } = quotationIdParamSchema.parse(req.params);
  const data = await QuotationService.getMineById(requireUserId(req), quotationId);
  sendResponse(res, { statusCode: 200, message: "Quotation retrieved successfully", data });
});

const update = catchAsync(async (req: Request, res: Response) => {
  const { quotationId } = quotationIdParamSchema.parse(req.params);
  const data = await QuotationService.update(
    requireUserId(req),
    quotationId,
    req.body,
    getAuditContext(req),
  );
  sendResponse(res, { statusCode: 200, message: "Quotation updated successfully", data });
});

const withdraw = catchAsync(async (req: Request, res: Response) => {
  const { quotationId } = quotationIdParamSchema.parse(req.params);
  const data = await QuotationService.withdraw(
    requireUserId(req),
    quotationId,
    getAuditContext(req),
  );
  sendResponse(res, { statusCode: 200, message: "Quotation withdrawn successfully", data });
});

export const QuotationController = {
  submit,
  listMine,
  getMineById,
  update,
  withdraw,
};

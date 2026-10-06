import type { Request, Response } from "express";
import { AppError } from "../../errors/AppError.js";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { RfqService } from "./rfq.service.js";
import {
  myRfqListQuerySchema,
  openRfqListQuerySchema,
  rfqIdParamSchema,
} from "./rfq.validation.js";

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

const createDraft = catchAsync(async (req: Request, res: Response) => {
  const data = await RfqService.createDraft(
    requireUserId(req),
    req.body,
    getAuditContext(req),
  );
  sendResponse(res, {
    statusCode: 201,
    message: "RFQ draft created successfully",
    data,
  });
});

const listMine = catchAsync(async (req: Request, res: Response) => {
  const query = myRfqListQuerySchema.parse(req.query);
  const data = await RfqService.listMine(requireUserId(req), query);
  sendResponse(res, {
    statusCode: 200,
    message: "Buyer RFQs retrieved successfully",
    data,
  });
});

const getMineById = catchAsync(async (req: Request, res: Response) => {
  const { rfqId } = rfqIdParamSchema.parse(req.params);
  const data = await RfqService.getMineById(requireUserId(req), rfqId);
  sendResponse(res, {
    statusCode: 200,
    message: "RFQ retrieved successfully",
    data,
  });
});

const updateDraft = catchAsync(async (req: Request, res: Response) => {
  const { rfqId } = rfqIdParamSchema.parse(req.params);
  const data = await RfqService.updateDraft(
    requireUserId(req),
    rfqId,
    req.body,
    getAuditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: "RFQ draft updated successfully",
    data,
  });
});

const publish = catchAsync(async (req: Request, res: Response) => {
  const { rfqId } = rfqIdParamSchema.parse(req.params);
  const data = await RfqService.publish(
    requireUserId(req),
    rfqId,
    getAuditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: "RFQ published successfully",
    data,
  });
});

const cancel = catchAsync(async (req: Request, res: Response) => {
  const { rfqId } = rfqIdParamSchema.parse(req.params);
  const data = await RfqService.cancel(
    requireUserId(req),
    rfqId,
    getAuditContext(req),
  );
  sendResponse(res, {
    statusCode: 200,
    message: "RFQ cancelled successfully",
    data,
  });
});

const softDelete = catchAsync(async (req: Request, res: Response) => {
  const { rfqId } = rfqIdParamSchema.parse(req.params);
  await RfqService.softDelete(requireUserId(req), rfqId, getAuditContext(req));
  sendResponse(res, {
    statusCode: 200,
    message: "RFQ deleted successfully",
    data: null,
  });
});

const listOpen = catchAsync(async (req: Request, res: Response) => {
  const query = openRfqListQuerySchema.parse(req.query);
  const data = await RfqService.listOpen(query);
  sendResponse(res, {
    statusCode: 200,
    message: "Open RFQs retrieved successfully",
    data,
  });
});

const getOpenById = catchAsync(async (req: Request, res: Response) => {
  const { rfqId } = rfqIdParamSchema.parse(req.params);
  const data = await RfqService.getOpenById(rfqId);
  sendResponse(res, {
    statusCode: 200,
    message: "Open RFQ retrieved successfully",
    data,
  });
});

export const RfqController = {
  createDraft,
  listMine,
  getMineById,
  updateDraft,
  publish,
  cancel,
  softDelete,
  listOpen,
  getOpenById,
};

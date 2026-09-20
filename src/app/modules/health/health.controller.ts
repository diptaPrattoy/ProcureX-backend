import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { HealthService } from "./health.service.js";

const getHealth = catchAsync(async (_req: Request, res: Response) => {
  const data = await HealthService.getStatus();

  return sendResponse(res, {
    statusCode: 200,
    message: "ProcuraX API is healthy",
    data,
  });
});

export const HealthController = {
  getHealth,
};

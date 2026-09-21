import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { AdminDashboardService } from "./admin-dashboard.service.js";
import {
  dashboardRangeQuerySchema,
  dashboardTrendQuerySchema,
} from "./admin-dashboard.validation.js";

const overview = catchAsync(async (req: Request, res: Response) => {
  const query = dashboardRangeQuerySchema.parse(req.query);
  const data = await AdminDashboardService.getOverview(query);
  sendResponse(res, {
    statusCode: 200,
    message: "Admin dashboard overview retrieved successfully",
    data,
  });
});

const financials = catchAsync(async (req: Request, res: Response) => {
  const query = dashboardRangeQuerySchema.parse(req.query);
  const data = await AdminDashboardService.getFinancials(query);
  sendResponse(res, {
    statusCode: 200,
    message: "Admin financial analytics retrieved successfully",
    data,
  });
});

const trends = catchAsync(async (req: Request, res: Response) => {
  const query = dashboardTrendQuerySchema.parse(req.query);
  const data = await AdminDashboardService.getTrends(query);
  sendResponse(res, {
    statusCode: 200,
    message: "Admin procurement trends retrieved successfully",
    data,
  });
});

export const AdminDashboardController = {
  overview,
  financials,
  trends,
};

import type { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.js";
import { sendResponse } from "../../utils/sendResponse.js";
import { CategoryService } from "./category.service.js";
import { categoryListQuerySchema } from "./category.validation.js";

const list = catchAsync(async (req: Request, res: Response) => {
  const query = categoryListQuerySchema.parse(req.query);
  const result = await CategoryService.list(query);

  sendResponse(res, {
    statusCode: 200,
    message: "Procurement categories retrieved successfully",
    data: result,
  });
});

export const CategoryController = { list };

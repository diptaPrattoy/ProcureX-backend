import type { Response } from "express";

type ApiResponse<T> = {
  statusCode: number;
  message: string;
  data: T;
};

export const sendResponse = <T>(
  res: Response,
  { statusCode, message, data }: ApiResponse<T>,
): Response => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

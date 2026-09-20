import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

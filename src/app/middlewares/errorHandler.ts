import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

type ErrorWithCode = Error & {
  code?: string;
  meta?: unknown;
};

export const globalErrorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let statusCode = 500;
  let message = "Something went wrong";
  let errors: unknown[] = [];

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errors = error.errors;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = "Validation failed";
    errors = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  } else if (error instanceof Error && (error as ErrorWithCode).code === "P2002") {
    statusCode = 409;
    message = "A record with the same unique value already exists";
  } else if (error instanceof Error && (error as ErrorWithCode).code === "P2025") {
    statusCode = 404;
    message = "Requested record was not found";
  } else if (error instanceof Error) {
    message = env.NODE_ENV === "development" ? error.message || message : message;
  }

  const payload: Record<string, unknown> = {
    success: false,
    message,
    errors,
  };

  if (env.NODE_ENV === "development" && error instanceof Error) {
    payload.stack = error.stack;
  }

  res.status(statusCode).json(payload);
};

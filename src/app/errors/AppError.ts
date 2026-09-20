export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors: unknown[];
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    errors: unknown[] = [],
    isOperational = true,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

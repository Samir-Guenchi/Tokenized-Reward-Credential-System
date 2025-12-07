/**
 * @file src/middleware/errorHandler.ts
 * @description Global error handling middleware
 *
 * =============================================================================
 * LEARNING PATH - Error Handling
 * =============================================================================
 *
 * Centralized error handling ensures:
 * 1. Consistent error response format
 * 2. Proper logging of errors
 * 3. No sensitive info leaked in production
 * 4. Graceful handling of unexpected errors
 *
 * =============================================================================
 */

import { Request, Response, NextFunction } from "express";
import { ApiError, isApiError, InternalError } from "../utils/errors.js";
import { logger, logError } from "../utils/logger.js";

/**
 * Error response format
 */
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    stack?: string;
  };
}

/**
 * Global error handler middleware
 * Must be registered LAST in the middleware chain
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log the error
  logError(error, `${req.method} ${req.path}`);

  // Determine if this is an operational error we can handle
  let apiError: ApiError;
  
  if (isApiError(error)) {
    apiError = error;
  } else {
    // Wrap unexpected errors
    apiError = new InternalError(
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : error.message
    );
  }

  // Build response
  const response: ErrorResponse = {
    success: false,
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details && { details: apiError.details }),
      // Include stack trace in development
      ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
    },
  };

  res.status(apiError.statusCode).json(response);
}

/**
 * 404 handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

/**
 * Async wrapper to catch errors in async route handlers
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

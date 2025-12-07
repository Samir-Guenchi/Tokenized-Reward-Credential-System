/**
 * @file src/utils/errors.ts
 * @description Custom error classes for the TRCS API
 *
 * =============================================================================
 * LEARNING PATH - Error Handling
 * =============================================================================
 *
 * Custom error classes provide:
 * 1. Consistent error format across the API
 * 2. HTTP status codes embedded in errors
 * 3. Easy error serialization for responses
 * 4. Type-safe error handling
 *
 * ERROR HIERARCHY:
 * - ApiError (base class)
 *   ├── BadRequestError (400)
 *   ├── UnauthorizedError (401)
 *   ├── ForbiddenError (403)
 *   ├── NotFoundError (404)
 *   ├── ConflictError (409)
 *   ├── ValidationError (422)
 *   ├── RateLimitError (429)
 *   └── InternalError (500)
 *
 * =============================================================================
 */

/**
 * Base API error class
 * All custom errors should extend this class
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);

    // Set prototype explicitly for ES6 class
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * Serialize error for API response
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

/**
 * 400 Bad Request - Invalid request format or parameters
 */
export class BadRequestError extends ApiError {
  constructor(message = "Bad request", details?: Record<string, unknown>) {
    super(message, 400, "BAD_REQUEST", true, details);
  }
}

/**
 * 401 Unauthorized - Missing or invalid authentication
 */
export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED", true);
  }
}

/**
 * 403 Forbidden - Authenticated but not authorized
 */
export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN", true);
  }
}

/**
 * 404 Not Found - Resource not found
 */
export class NotFoundError extends ApiError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND", true);
  }
}

/**
 * 409 Conflict - Resource already exists or conflict state
 */
export class ConflictError extends ApiError {
  constructor(message = "Resource conflict") {
    super(message, 409, "CONFLICT", true);
  }
}

/**
 * 422 Unprocessable Entity - Validation failed
 */
export class ValidationError extends ApiError {
  constructor(message = "Validation failed", details?: Record<string, unknown>) {
    super(message, 422, "VALIDATION_ERROR", true, details);
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends ApiError {
  constructor(message = "Too many requests, please try again later") {
    super(message, 429, "RATE_LIMIT_EXCEEDED", true);
  }
}

/**
 * 500 Internal Server Error - Unexpected server error
 */
export class InternalError extends ApiError {
  constructor(message = "Internal server error") {
    super(message, 500, "INTERNAL_ERROR", false);
  }
}

/**
 * Blockchain-specific error
 */
export class BlockchainError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 502, "BLOCKCHAIN_ERROR", true, details);
  }
}

/**
 * IPFS-specific error
 */
export class IpfsError extends ApiError {
  constructor(message: string) {
    super(message, 502, "IPFS_ERROR", true);
  }
}

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

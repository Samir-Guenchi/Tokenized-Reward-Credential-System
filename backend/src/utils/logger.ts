/**
 * @file src/utils/logger.ts
 * @description Winston logger configuration for structured logging
 *
 * =============================================================================
 * LEARNING PATH - Logging Best Practices
 * =============================================================================
 *
 * Why structured logging?
 * 1. Easier to parse and search in production
 * 2. Consistent format across the application
 * 3. Different transports for different environments
 * 4. Log levels for filtering
 *
 * LOG LEVELS (from most to least severe):
 * - error: System errors that need immediate attention
 * - warn: Warning conditions that might need attention
 * - info: Normal operational messages
 * - debug: Detailed debugging information
 *
 * =============================================================================
 */

import winston from "winston";

const { combine, timestamp, printf, colorize, json } = winston.format;

/**
 * Custom format for development (human-readable)
 */
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${JSON.stringify(metadata)}`;
  }
  return msg;
});

/**
 * Create the Winston logger instance
 */
const createLogger = () => {
  const isDev = process.env.NODE_ENV !== "production";

  return winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: combine(
      timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      isDev ? combine(colorize(), devFormat) : json()
    ),
    defaultMeta: { service: "trcs-backend" },
    transports: [
      // Console transport (always enabled)
      new winston.transports.Console(),

      // File transports for production
      ...(isDev
        ? []
        : [
            new winston.transports.File({
              filename: "logs/error.log",
              level: "error",
            }),
            new winston.transports.File({
              filename: "logs/combined.log",
            }),
          ]),
    ],
  });
};

export const logger = createLogger();

/**
 * Log HTTP request details
 */
export const logRequest = (
  method: string,
  url: string,
  statusCode: number,
  duration: number
) => {
  const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";
  logger.log(level, `${method} ${url} ${statusCode} - ${duration}ms`);
};

/**
 * Log blockchain transaction
 */
export const logTransaction = (
  action: string,
  txHash: string,
  from: string,
  to?: string
) => {
  logger.info(`Blockchain TX: ${action}`, {
    txHash,
    from,
    to,
  });
};

/**
 * Log error with stack trace
 */
export const logError = (error: Error, context?: string) => {
  logger.error(context || "An error occurred", {
    message: error.message,
    stack: error.stack,
    name: error.name,
  });
};

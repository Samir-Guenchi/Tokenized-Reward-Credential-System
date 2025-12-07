/**
 * @file src/index.ts
 * @description Main entry point for the TRCS backend API
 *
 * =============================================================================
 * LEARNING PATH - Express Application Setup
 * =============================================================================
 *
 * This file initializes the Express application with:
 * 1. Security middleware (helmet, cors, rate limiting)
 * 2. Logging (morgan)
 * 3. Body parsing
 * 4. Route registration
 * 5. Error handling
 * 6. Graceful shutdown
 *
 * STARTUP SEQUENCE:
 * 1. Load configuration
 * 2. Initialize services (blockchain, IPFS)
 * 3. Set up middleware
 * 4. Register routes
 * 5. Start HTTP server
 *
 * =============================================================================
 */

import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { getBlockchainService } from "./services/blockchain.js";
import { getIpfsService } from "./services/ipfs.js";

// Routes
import authRoutes from "./routes/auth.js";
import tokenRoutes from "./routes/tokens.js";
import credentialRoutes from "./routes/credentials.js";
import rewardRoutes from "./routes/rewards.js";
import healthRoutes from "./routes/health.js";
import demoRoutes from "./routes/demo.js";

/**
 * Create and configure the Express application
 */
function createApp(): Express {
  const app = express();

  // ==========================================================================
  // Security Middleware
  // ==========================================================================

  // Helmet sets various HTTP headers for security
  app.use(helmet());

  // CORS configuration - allow all origins in development
  const corsOrigin = process.env.NODE_ENV === 'production' 
    ? config.cors.origin 
    : true; // Allow all origins in development
  
  app.use(
    cors({
      origin: corsOrigin,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests, please try again later",
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // ==========================================================================
  // Request Processing
  // ==========================================================================

  // Logging
  app.use(
    morgan(config.logging.format, {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );

  // Body parsing
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ==========================================================================
  // Routes
  // ==========================================================================

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/tokens", tokenRoutes);
  app.use("/api/credentials", credentialRoutes);
  app.use("/api/rewards", rewardRoutes);
  app.use("/api/demo", demoRoutes);
  app.use("/health", healthRoutes);

  // Root route
  app.get("/", (req, res) => {
    res.json({
      name: "TRCS Backend API",
      version: "1.0.0",
      description: "Tokenized Reward & Credential System",
      endpoints: {
        health: "/health",
        auth: "/api/auth",
        tokens: "/api/tokens",
        credentials: "/api/credentials",
        rewards: "/api/rewards",
      },
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  // 404 handler for undefined routes
  app.use(notFoundHandler);

  // Global error handler
  app.use(errorHandler);

  return app;
}

/**
 * Initialize services
 */
async function initializeServices(): Promise<void> {
  // Initialize blockchain service
  getBlockchainService({
    rpcUrl: config.blockchain.rpcUrl,
    privateKey: config.blockchain.privateKey,
    addresses: {
      accessControl: config.contracts.accessControl,
      token: config.contracts.token,
      credential: config.contracts.credential,
      rewardDistributor: config.contracts.rewardDistributor,
    },
  });

  // Initialize IPFS service
  getIpfsService({
    host: config.ipfs.host,
    port: config.ipfs.port,
    protocol: config.ipfs.protocol,
    gateway: config.ipfs.gateway,
  });

  logger.info("Services initialized");
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    // Initialize services
    await initializeServices();

    // Create app
    const app = createApp();

    // Start listening
    const server = app.listen(config.server.port, config.server.host, () => {
      logger.info(`🚀 TRCS Backend started`, {
        host: config.server.host,
        port: config.server.port,
        env: config.server.env,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`);
      
      server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 30000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

  } catch (error) {
    logger.error("Failed to start server", { error });
    process.exit(1);
  }
}

// Start the server
startServer();

export { createApp };
